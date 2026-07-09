var MidtsVendorSafePackageService = (function () {
  function preparePackage(leadId, reviewer) {
    if (!leadId) return { ok:false, code:'MISSING_LEAD_ID', message:'Lead ID is required.' };
    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok:false, code:'LEAD_NOT_FOUND', message:'Lead not found: ' + leadId };
    if (String(leadResult.lead['Lifecycle Status'] || '') !== 'Vendor Safe Review') {
      return { ok:false, code:'LEAD_NOT_READY', message:'Lead must be in Vendor Safe Review.' };
    }

    var review = MidtsSheetService.findLatestTechnicalReviewByLeadId(leadId);
    if (!review || String(review.review['Recommendation'] || '') !== 'Qualified') {
      return { ok:false, code:'TECHNICAL_REVIEW_REQUIRED', message:'A Qualified Technical Review is required.' };
    }

    var intakeResult = MidtsSheetService.findLatestTechnicalIntakeByLeadId(leadId);
    if (!intakeResult) return { ok:false, code:'TECHNICAL_INTAKE_REQUIRED', message:'Latest Technical Intake is required before a vendor-safe package can be generated.' };
    var intake = intakeResult.intake || {};
    var sourceFileLinks = validDriveLinks_(splitList_(intake['File Links']));
    if (String(intake['Files Provided'] || '').trim().toLowerCase() === 'yes' && !sourceFileLinks.length) {
      return { ok:false, code:'VSP_SOURCE_FILES_MISSING', message:'Step 2 says files were provided, but no valid Drive file links were found in Technical Intake. Regenerate Step 2 file links before creating the vendor-safe package.' };
    }

    var previous = MidtsSheetService.findLatestVendorSafePackageByLeadId(leadId);
    if (previous && String(previous.vendorSafePackage['Package Status'] || '') === 'Approved for Vendor Pricing') {
      var previousManifest = parseJson_(previous.vendorSafePackage['Package JSON']);
      if (packageManifestLooksComplete_(previousManifest, sourceFileLinks.length)) {
        return {
          ok:true,
          alreadyPrepared:true,
          packageId:previous.vendorSafePackage['Package ID'],
          driveFolderUrl:previous.vendorSafePackage['Drive Folder URL'],
          package:previousManifest,
          generatedDocuments:previousManifest.generatedDocuments || [],
          copiedClientFiles:previousManifest.clientFiles || []
        };
      }
    }

    var now = new Date();
    var packageId = 'VSP-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random()*9000+1000);
    var packageFolder = MidtsDriveService.getVendorSafePackageFolder(leadId, packageId);
    var clientFilesFolder = getOrCreateSubfolder_(packageFolder, '06 Client Files');
    var midtsFilesFolder = getOrCreateSubfolder_(packageFolder, '07 MIDTS Files');

    var copiedClientFiles = MidtsDriveService.copyFilesByUrl(sourceFileLinks, clientFilesFolder);
    var successfulClientFiles = copiedClientFiles.filter(function (file) { return file && file.id && !file.error; });
    if (sourceFileLinks.length && successfulClientFiles.length !== sourceFileLinks.length) {
      return { ok:false, code:'VSP_CLIENT_FILE_COPY_FAILED', message:'One or more Step 2 files could not be copied into the vendor-safe package. Check Drive permissions and source file links before sending to vendors.', copiedClientFiles:copiedClientFiles };
    }

    var packageData = buildPackageData_(packageId, now, leadResult.lead, intake, review.review, successfulClientFiles, packageFolder.getUrl(), sourceFileLinks);
    var generatedDocs = generatePackageDocs_(packageFolder, packageData, leadResult.lead, intake, review.review);
    if (generatedDocs.length < 7) {
      return { ok:false, code:'VSP_DOCUMENT_GENERATION_INCOMPLETE', message:'Vendor-safe package documents were not fully generated. Do not send this package to vendors.', generatedDocuments:generatedDocs };
    }

    var manifest = Object.assign({}, packageData, {
      generatedDocuments: generatedDocs,
      clientFiles: successfulClientFiles,
      clientFilesFolderUrl: clientFilesFolder.getUrl(),
      midtsFilesFolderUrl: midtsFilesFolder.getUrl()
    });
    var manifestJson = JSON.stringify(manifest);

    MidtsSheetService.appendVendorSafePackageRow([
      packageId,
      leadId,
      review.review['Technical Review ID'] || '',
      now,
      reviewer || 'Vendor Safe Review',
      'Approved for Vendor Pricing',
      packageFolder.getUrl(),
      manifestJson,
      hash_(manifestJson),
      now,
      now
    ]);

    return {
      ok:true,
      packageId:packageId,
      driveFolderUrl:packageFolder.getUrl(),
      package:manifest,
      generatedDocuments:generatedDocs,
      copiedClientFiles:successfulClientFiles
    };
  }

  function buildPackageData_(packageId, now, lead, intake, review, copiedClientFiles, folderUrl, sourceFileLinks) {
    return {
      schemaVersion:'2.1',
      packageType:'vendor-safe-procurement-package',
      packageId:packageId,
      packageRevision:'1',
      issueDate:Utilities.formatDate(now, 'Europe/London', 'dd MMM yyyy HH:mm'),
      preparedBy:'MIDTS',
      preparedFor:'Approved manufacturing vendor',
      folderUrl:folderUrl,
      leadId:String(lead['Lead ID'] || ''),
      quoteReference:String(lead['Quote Reference'] || ''),
      projectType:String(lead['Project Type'] || intake['Service Type'] || ''),
      scopeOfWork:String(intake['Technical Scope'] || lead['Brief Requirement'] || ''),
      sourceFileLinks:sourceFileLinks || [],
      clientRequirements:{
        briefRequirement:String(lead['Brief Requirement'] || ''),
        materials:String(intake['Materials'] || ''),
        quantity:String(intake['Quantity'] || ''),
        deadline:String(intake['Deadline'] || ''),
        timingNotes:String(intake['Timing Notes'] || ''),
        budgetRange:String(intake['Budget Range'] || ''),
        filesProvided:String(intake['Files Provided'] || ''),
        confidentialityNotes:String(intake['Confidentiality Notes'] || '')
      },
      technicalReview:{
        technicalReviewId:String(review['Technical Review ID'] || ''),
        summary:String(review['Review Summary'] || ''),
        fileReview:String(review['File Review'] || ''),
        risks:String(review['Risks'] || ''),
        clarifications:String(review['Clarifications'] || ''),
        recommendation:String(review['Recommendation'] || '')
      },
      vendorInstructions:[
        'Review the full package before pricing.',
        'Quote must include lead time, currency, assumptions, exclusions, and validity period.',
        'Do not contact the client directly. All questions must be sent to MIDTS.',
        'Do not share package files outside your organisation without MIDTS written approval.',
        'State whether material, finishing, inspection, packaging, and delivery are included.',
        'Flag missing data before quoting if the package is not sufficient for a reliable price.'
      ],
      exclusions:[
        'Client direct contact details are removed from the vendor-safe package.',
        'MIDTS margin, client price, payment terms, and commercial strategy are excluded.',
        'Vendor must not treat this package as production approval unless explicitly stated.'
      ],
      copiedClientFiles:copiedClientFiles
    };
  }

  function generatePackageDocs_(folder, data, lead, intake, review) {
    var docs = [];
    var requirementSheet = MidtsDocumentAdapterService.toRequirementSheetData(lead, intake, { reference:data.packageId + '-REQ', revision:data.packageRevision, status:'issued' });
    var technicalReview = MidtsDocumentAdapterService.toTechnicalReviewData(lead, intake, review, { reference:data.packageId + '-TR', revision:data.packageRevision, status:'issued' });

    docs.push(createDoc_(folder, '01 Cover Sheet - ' + data.packageId, [
      { heading:'Document Control', lines:[
        'Document: Vendor Safe Package Cover Sheet',
        'Package ID: ' + data.packageId,
        'Lead ID: ' + data.leadId,
        'Revision: ' + data.packageRevision,
        'Issue date: ' + data.issueDate,
        'Prepared by: ' + data.preparedBy,
        'Project type: ' + data.projectType,
        'Vendor package folder: ' + data.folderUrl
      ]},
      { heading:'Package Contents', lines:[
        '02 Scope of Work',
        '03 Client Requirements',
        '04 Technical Review',
        '05 Vendor Instructions',
        '06 RFQ Response Template',
        '07 Document Register',
        '06 Client Files folder',
        '07 MIDTS Files folder'
      ]},
      { heading:'Confidentiality', lines:data.exclusions }
    ]));

    docs.push(createDoc_(folder, '02 Scope of Work - ' + data.packageId, [
      { heading:'Scope of Work', lines:[data.scopeOfWork || 'Scope not recorded.'] },
      { heading:'Manufacturing Objective', lines:['Vendor to review the supplied requirement and files and provide a commercial quotation based on stated assumptions.'] },
      { heading:'Deliverables Requested', lines:['Vendor pricing response', 'Lead time', 'Assumptions and exclusions', 'Questions or missing information'] },
      { heading:'Commercial Assumptions', lines:['Pricing must include what is included and excluded. Do not assume MIDTS or client approval of production without written confirmation.'] }
    ]));

    docs.push(createDoc_(folder, '03 Client Requirements - ' + data.packageId, [
      { heading:'Document Data Source', lines:['Generated from MIDTS Document Adapter: requirementSheet', 'Reference: ' + requirementSheet.reference, 'Revision: ' + requirementSheet.revision, 'Status: ' + requirementSheet.status] },
      { heading:'Requirement Summary', lines:[requirementSheet.requirementSummary || 'Not recorded'] },
      { heading:'Intake Fields', lines:(requirementSheet.intakeFields || []).map(function (row) { return row.label + ': ' + row.value; }) },
      { heading:'Technical Inputs', lines:requirementSheet.technicalInputs || ['Not recorded'] },
      { heading:'Constraints', lines:requirementSheet.constraints || ['Not recorded'] },
      { heading:'Open Questions', lines:requirementSheet.openQuestions && requirementSheet.openQuestions.length ? requirementSheet.openQuestions : ['None recorded'] }
    ]));

    docs.push(createDoc_(folder, '04 Technical Review - ' + data.packageId, [
      { heading:'Document Data Source', lines:['Generated from MIDTS Document Adapter: technicalReview', 'Reference: ' + technicalReview.reference, 'Revision: ' + technicalReview.revision, 'Status: ' + technicalReview.status] },
      { heading:'Review Summary', lines:[technicalReview.reviewSummary || 'Not recorded'] },
      { heading:'File Review', lines:(technicalReview.fileReview || []).map(function (row) { return row.area + ': ' + row.finding + ' [' + row.status + ']'; }) },
      { heading:'Risks', lines:technicalReview.risks && technicalReview.risks.length ? technicalReview.risks : ['None recorded'] },
      { heading:'Clarifications', lines:technicalReview.clarifications && technicalReview.clarifications.length ? technicalReview.clarifications : ['None recorded'] },
      { heading:'Recommendation', lines:[technicalReview.recommendation || 'Not recorded'] }
    ]));

    docs.push(createDoc_(folder, '05 Vendor Instructions - ' + data.packageId, [
      { heading:'Instructions', lines:data.vendorInstructions },
      { heading:'Required Quote Response', lines:[
        'Unit price or total price.',
        'Tooling/NRE cost if applicable.',
        'Minimum order quantity if applicable.',
        'Lead time.',
        'Quote validity period.',
        'Material and process assumptions.',
        'Inspection/certification included or excluded.',
        'Delivery/shipping assumptions.',
        'Questions or missing information.'
      ]}
    ]));

    docs.push(createDoc_(folder, '06 RFQ Response Template - ' + data.packageId, [
      { heading:'Vendor Response Fields', lines:[
        'Vendor name:',
        'Vendor quote reference:',
        'Total quoted cost:',
        'Currency:',
        'Unit price:',
        'Tooling/NRE:',
        'MOQ:',
        'Lead time:',
        'Quote valid until:',
        'Material assumptions:',
        'Manufacturing process:',
        'Inspection/certification included:',
        'Shipping/packaging included:',
        'Exclusions:',
        'Questions for MIDTS:'
      ]}
    ]));

    var registerLines = [
      '01 Cover Sheet - Generated by MIDTS',
      '02 Scope of Work - Generated by MIDTS',
      '03 Client Requirements - Generated from Step 1 and Step 2',
      '04 Technical Review - Generated from MIDTS review record',
      '05 Vendor Instructions - MIDTS standard instructions',
      '06 RFQ Response Template - Vendor response structure'
    ].concat((data.copiedClientFiles || []).map(function (file, index) {
      return 'Client File ' + (index + 1) + ': ' + file.name + ' - ' + file.url;
    }));

    docs.push(createDoc_(folder, '07 Document Register - ' + data.packageId, [
      { heading:'Register', lines:registerLines },
      { heading:'Source File Links', lines:data.sourceFileLinks && data.sourceFileLinks.length ? data.sourceFileLinks : ['No source file links recorded'] }
    ]));

    return docs;
  }

  function createDoc_(folder, title, sections) {
    return MidtsDriveService.createGoogleDocInFolder(folder, title, sections);
  }

  function packageManifestLooksComplete_(manifest, expectedClientFileCount) {
    if (!manifest) return false;
    if (!Array.isArray(manifest.generatedDocuments) || manifest.generatedDocuments.length < 7) return false;
    if (expectedClientFileCount && (!Array.isArray(manifest.clientFiles) || manifest.clientFiles.length < expectedClientFileCount)) return false;
    return true;
  }

  function validDriveLinks_(links) {
    return (links || []).filter(function (link) { return /^https:\/\/drive\.google\.com\//i.test(String(link || '')); });
  }

  function getOrCreateSubfolder_(folder, name) {
    var matches = folder.getFoldersByName(name);
    return matches.hasNext() ? matches.next() : folder.createFolder(name);
  }

  function splitList_(value) {
    return String(value || '').split(/[\n,]+/).map(function (item) { return String(item || '').trim(); }).filter(Boolean);
  }

  function parseJson_(value) {
    try { return JSON.parse(String(value || '').trim() || '{}') || {}; }
    catch (error) { return {}; }
  }

  function hash_(value) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8).map(function(byte) {
      var safe=byte<0?byte+256:byte;
      return ('0'+safe.toString(16)).slice(-2);
    }).join('');
  }

  return { preparePackage:preparePackage };
})();
