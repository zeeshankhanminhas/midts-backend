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

    var previous = MidtsSheetService.findLatestVendorSafePackageByLeadId(leadId);
    if (previous && String(previous.vendorSafePackage['Package Status'] || '') === 'Approved for Vendor Pricing') {
      return { ok:true, alreadyPrepared:true, packageId:previous.vendorSafePackage['Package ID'], driveFolderUrl:previous.vendorSafePackage['Drive Folder URL'] };
    }

    var intakeResult = MidtsSheetService.findLatestTechnicalIntakeByLeadId(leadId);
    var intake = intakeResult ? intakeResult.intake : {};
    var now = new Date();
    var packageId = 'VSP-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random()*9000+1000);
    var packageFolder = MidtsDriveService.getVendorSafePackageFolder(leadId, packageId);
    var clientFilesFolder = getOrCreateSubfolder_(packageFolder, '06 Client Files');
    var midtsFilesFolder = getOrCreateSubfolder_(packageFolder, '07 MIDTS Files');
    var fileLinks = splitList_(intake['File Links']);
    var copiedClientFiles = MidtsDriveService.copyFilesByUrl(fileLinks, clientFilesFolder);
    var packageData = buildPackageData_(packageId, now, leadResult.lead, intake, review.review, copiedClientFiles, packageFolder.getUrl());
    var generatedDocs = generatePackageDocs_(packageFolder, packageData);

    var manifest = Object.assign({}, packageData, {
      generatedDocuments: generatedDocs,
      clientFiles: copiedClientFiles,
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
      copiedClientFiles:copiedClientFiles
    };
  }

  function buildPackageData_(packageId, now, lead, intake, review, copiedClientFiles, folderUrl) {
    return {
      schemaVersion:'2.0',
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

  function generatePackageDocs_(folder, data) {
    var docs = [];
    docs.push(MidtsDriveService.createGoogleDocInFolder(folder, '01 Cover Sheet - ' + data.packageId, [
      { heading:'Package', lines:[
        'Package ID: ' + data.packageId,
        'Lead ID: ' + data.leadId,
        'Revision: ' + data.packageRevision,
        'Issue date: ' + data.issueDate,
        'Prepared by: ' + data.preparedBy,
        'Project type: ' + data.projectType,
        'Vendor package folder: ' + data.folderUrl
      ]},
      { heading:'Confidentiality', lines:data.exclusions }
    ]));

    docs.push(MidtsDriveService.createGoogleDocInFolder(folder, '02 Scope of Work - ' + data.packageId, [
      { heading:'Scope of Work', lines:[data.scopeOfWork || 'Scope not recorded.'] },
      { heading:'Project Type', lines:[data.projectType || 'Not recorded'] }
    ]));

    docs.push(MidtsDriveService.createGoogleDocInFolder(folder, '03 Client Requirements - ' + data.packageId, [
      { heading:'Client Requirement', lines:[data.clientRequirements.briefRequirement || 'Not recorded'] },
      { heading:'Materials', lines:[data.clientRequirements.materials || 'Not recorded'] },
      { heading:'Quantity', lines:[data.clientRequirements.quantity || 'Not recorded'] },
      { heading:'Deadline / Timing', lines:[data.clientRequirements.deadline || 'Not recorded', data.clientRequirements.timingNotes || ''] },
      { heading:'Budget / Commercial Context', lines:[data.clientRequirements.budgetRange || 'Not recorded'] },
      { heading:'Files Provided', lines:[data.clientRequirements.filesProvided || 'Not recorded'] },
      { heading:'Confidentiality Notes', lines:[data.clientRequirements.confidentialityNotes || 'None recorded'] }
    ]));

    docs.push(MidtsDriveService.createGoogleDocInFolder(folder, '04 Technical Review - ' + data.packageId, [
      { heading:'Technical Review ID', lines:[data.technicalReview.technicalReviewId || 'Not recorded'] },
      { heading:'Summary', lines:[data.technicalReview.summary || 'Not recorded'] },
      { heading:'File Review', lines:[data.technicalReview.fileReview || 'Not recorded'] },
      { heading:'Risks', lines:[data.technicalReview.risks || 'None recorded'] },
      { heading:'Clarifications', lines:[data.technicalReview.clarifications || 'None recorded'] },
      { heading:'Recommendation', lines:[data.technicalReview.recommendation || 'Not recorded'] }
    ]));

    docs.push(MidtsDriveService.createGoogleDocInFolder(folder, '05 Vendor Instructions - ' + data.packageId, [
      { heading:'Instructions', lines:data.vendorInstructions },
      { heading:'Required quote response', lines:[
        'Unit price or total price.',
        'Tooling/NRE cost if applicable.',
        'Lead time.',
        'Quote validity period.',
        'Material and process assumptions.',
        'Inspection/certification included or excluded.',
        'Delivery/shipping assumptions.',
        'Questions or missing information.'
      ]}
    ]));
    return docs;
  }

  function getOrCreateSubfolder_(folder, name) {
    var matches = folder.getFoldersByName(name);
    return matches.hasNext() ? matches.next() : folder.createFolder(name);
  }

  function splitList_(value) {
    return String(value || '').split(/[\n,]+/).map(function (item) { return String(item || '').trim(); }).filter(Boolean);
  }

  function hash_(value) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8).map(function(byte) {
      var safe=byte<0?byte+256:byte;
      return ('0'+safe.toString(16)).slice(-2);
    }).join('');
  }

  return { preparePackage:preparePackage };
})();
