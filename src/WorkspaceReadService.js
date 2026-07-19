var MidtsWorkspaceReadService = (function () {
  var VENDOR_REQUEST_HEADERS = [
    'Request ID',
    'Lead ID',
    'Technical Review ID',
    'Quote Reference',
    'Created At',
    'Sent At',
    'Vendor Name',
    'Vendor Email',
    'Vendor Package Link',
    'Reviewer Organisation',
    'Files And Revisions Priced',
    'Source Package ID',
    'Scope Revision',
    'Request Token Hash',
    'Request Status',
    'Partner Assessment Status',
    'Partner Assessment Link',
    'Pricing Readiness',
    'Submitted At',
    'Vendor Cost',
    'Vendor Currency',
    'Lead Time',
    'Quote Valid Until',
    'Exclusions',
    'Vendor Reference',
    'Vendor Notes',
    'Pricing ID',
    'Last Updated At'
  ];

  function listPendingTechnicalReviews() {
    var leads = readSheetObjects_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var intakes = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_INTAKE, MidtsSheetService.TECHNICAL_INTAKE_HEADERS);
    var reviews = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_REVIEWS, MidtsSheetService.TECHNICAL_REVIEW_HEADERS);
    var packages = readSheetObjects_(MidtsSheetService.SHEETS.VENDOR_SAFE_PACKAGES, MidtsSheetService.VENDOR_SAFE_PACKAGE_HEADERS);
    var requests = readSheetObjects_('Vendor Requests', VENDOR_REQUEST_HEADERS);
    var latestIntakesByLead = latestByLeadId_(intakes, 'Completed At');
    var latestReviewsByLead = latestByLeadId_(reviews, 'Created At');
    var latestPackagesByLead = latestByLeadId_(packages, 'Created At');
    var latestRequestsByLead = latestByLeadId_(requests, 'Created At');

    var pending = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      if (!leadId) return false;
      return partnerAssessmentPending_(lead, latestRequestsByLead[leadId], latestReviewsByLead[leadId], latestPackagesByLead[leadId]);
    }).map(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      return toPendingReviewRecord_(lead, latestIntakesByLead[leadId], latestRequestsByLead[leadId], latestPackagesByLead[leadId]);
    });

    pending.sort(function (a, b) {
      return Number(new Date(b.submittedAt || b.dateCreated || 0)) - Number(new Date(a.submittedAt || a.dateCreated || 0));
    });

    return {
      ok: true,
      count: pending.length,
      reviews: pending
    };
  }

  function listPendingQualificationDecisions() {
    var leads = readSheetObjects_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var intakes = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_INTAKE, MidtsSheetService.TECHNICAL_INTAKE_HEADERS);
    var latestIntakesByLead = latestByLeadId_(intakes, 'Completed At');

    var pending = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      if (!leadId) return false;
      if (!step2Complete_(lead)) return false;
      return !qualificationDecisionComplete_(lead);
    }).map(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      return toPendingQualificationRecord_(lead, latestIntakesByLead[leadId], null);
    });

    pending.sort(function (a, b) {
      return Number(new Date(b.submittedAt || b.dateCreated || 0)) - Number(new Date(a.submittedAt || a.dateCreated || 0));
    });

    return {
      ok: true,
      count: pending.length,
      decisions: pending
    };
  }

  function listPendingVendorSafePackages() {
    var leads = readSheetObjects_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var intakes = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_INTAKE, MidtsSheetService.TECHNICAL_INTAKE_HEADERS);
    var reviews = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_REVIEWS, MidtsSheetService.TECHNICAL_REVIEW_HEADERS);
    var packages = readSheetObjects_(MidtsSheetService.SHEETS.VENDOR_SAFE_PACKAGES, MidtsSheetService.VENDOR_SAFE_PACKAGE_HEADERS);
    var latestIntakesByLead = latestByLeadId_(intakes, 'Completed At');
    var latestReviewsByLead = latestByLeadId_(reviews, 'Created At');
    var latestPackagesByLead = latestByLeadId_(packages, 'Created At');

    var pending = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      if (!leadId) return false;
      if (clean_(lead['Qualification Decision']) !== 'Qualified') return false;
      return vendorSafePackagePending_(lead, latestPackagesByLead[leadId]);
    }).map(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      return toVendorSafeRecord_(lead, latestIntakesByLead[leadId], latestReviewsByLead[leadId], latestPackagesByLead[leadId]);
    });

    pending.sort(function (a, b) {
      return Number(new Date(b.reviewedAt || b.submittedAt || b.dateCreated || 0)) - Number(new Date(a.reviewedAt || a.submittedAt || a.dateCreated || 0));
    });

    return {
      ok: true,
      count: pending.length,
      packages: pending
    };
  }

  function listPendingVendorRequestSetups() {
    var leads = readSheetObjects_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var intakes = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_INTAKE, MidtsSheetService.TECHNICAL_INTAKE_HEADERS);
    var reviews = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_REVIEWS, MidtsSheetService.TECHNICAL_REVIEW_HEADERS);
    var packages = readSheetObjects_(MidtsSheetService.SHEETS.VENDOR_SAFE_PACKAGES, MidtsSheetService.VENDOR_SAFE_PACKAGE_HEADERS);
    var requests = readSheetObjects_('Vendor Requests', VENDOR_REQUEST_HEADERS);
    var latestIntakesByLead = latestByLeadId_(intakes, 'Completed At');
    var latestReviewsByLead = latestByLeadId_(reviews, 'Created At');
    var latestPackagesByLead = latestByLeadId_(packages, 'Created At');
    var latestRequestsByLead = latestByLeadId_(requests, 'Created At');

    var pending = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      if (!leadId) return false;
      if (!vendorRequestSetupPending_(lead, latestRequestsByLead[leadId])) return false;
      return Boolean(clean_(lead['Vendor Pricing Required'])) && equivalent_(lead['Lifecycle Status'], ['vendor pricing']);
    }).map(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      return toVendorRequestRecord_(lead, latestIntakesByLead[leadId], latestReviewsByLead[leadId], latestPackagesByLead[leadId], latestRequestsByLead[leadId]);
    });

    pending.sort(function (a, b) {
      return Number(new Date(b.readyAt || b.reviewedAt || b.submittedAt || b.dateCreated || 0)) - Number(new Date(a.readyAt || a.reviewedAt || a.submittedAt || a.dateCreated || 0));
    });

    return {
      ok: true,
      count: pending.length,
      requests: pending
    };
  }

  function listPendingQuoteBuilders() {
    var leads = readSheetObjects_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var intakes = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_INTAKE, MidtsSheetService.TECHNICAL_INTAKE_HEADERS);
    var pricingRows = readSheetObjects_(MidtsSheetService.SHEETS.VENDOR_PRICING, MidtsSheetService.VENDOR_PRICING_HEADERS);
    var packages = readSheetObjects_(MidtsSheetService.SHEETS.VENDOR_SAFE_PACKAGES, MidtsSheetService.VENDOR_SAFE_PACKAGE_HEADERS);
    var latestIntakesByLead = latestByLeadId_(intakes, 'Completed At');
    var latestPricingByLead = latestPricingByLeadId_(pricingRows);
    var latestPackagesByLead = latestByLeadId_(packages, 'Created At');

    var quotes = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      if (!leadId) return false;
      if (!quoteBuilderPending_(lead)) return false;
      var pricing = latestPricingByLead[leadId];
      return pricing && clean_(pricing['Pricing Status']) === 'Margin Approved' && isYes_(pricing['Pricing Approved']);
    }).map(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      return toQuoteBuilderRecord_(lead, latestIntakesByLead[leadId], latestPricingByLead[leadId], latestPackagesByLead[leadId]);
    });

    quotes.sort(function (a, b) {
      return Number(new Date(b.marginApprovedAt || b.dateCreated || 0)) - Number(new Date(a.marginApprovedAt || a.dateCreated || 0));
    });

    return {
      ok: true,
      count: quotes.length,
      quotes: quotes
    };
  }

  function readSheetObjects_(sheetName, expectedHeaders) {
    var spreadsheetId = MidtsConfig.getSpreadsheetId();
    var spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('No SPREADSHEET_ID property and no active spreadsheet available.');

    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    return rows.map(function (row) {
      var object = {};
      headers.forEach(function (header, index) {
        if (header) object[header] = normalizeCell_(row[index]);
      });
      expectedHeaders.forEach(function (header) {
        if (object[header] === undefined) object[header] = '';
      });
      return object;
    });
  }

  function latestByLeadId_(rows, dateHeader) {
    return rows.reduce(function (map, row) {
      var leadId = clean_(row['Lead ID']);
      if (!leadId) return map;
      var existing = map[leadId];
      if (!existing || Number(new Date(row[dateHeader] || row['Last Updated At'] || 0)) >= Number(new Date(existing[dateHeader] || existing['Last Updated At'] || 0))) {
        map[leadId] = row;
      }
      return map;
    }, {});
  }

  function latestPricingByLeadId_(rows) {
    return rows.reduce(function (map, row) {
      var leadId = clean_(row['Lead ID']);
      if (!leadId) return map;
      var existing = map[leadId];
      if (!existing || isYes_(row['Latest Revision']) || Number(row['Quote Revision'] || 0) >= Number(existing['Quote Revision'] || 0)) {
        map[leadId] = row;
      }
      return map;
    }, {});
  }

  function toPendingReviewRecord_(lead, intake, request, vendorPackage) {
    intake = intake || {};
    request = request || {};
    vendorPackage = vendorPackage || {};
    var rawIntake = parseJson_(intake['Raw Payload JSON']);
    var submittedAt = request['Sent At'] || request['Created At'] || intake['Completed At'] || lead['Step 2 Completed At'] || lead['Last Updated At'] || lead['Created At'];
    var filesProvided = intake['Files Provided'] || lead['Files Provided'] || '';
    var fileLinks = splitList_(intake['File Links']);
    var packageLink = clean_(request['Vendor Package Link']) || clean_(vendorPackage['Drive Folder URL']);

    return {
      leadId: clean_(lead['Lead ID']),
      technicalIntakeId: clean_(intake['Technical Intake ID']),
      reviewRequestId: clean_(request['Request ID']),
      requestId: clean_(request['Request ID']),
      sourcePackageId: clean_(request['Source Package ID']) || clean_(vendorPackage['Package ID']),
      packageId: clean_(vendorPackage['Package ID']),
      packageLink: packageLink,
      partnerReviewPackageLink: packageLink,
      vendorName: clean_(request['Vendor Name']),
      vendorEmail: clean_(request['Vendor Email']),
      client: clean_(lead['Full Name']),
      personName: clean_(lead['Full Name']),
      company: clean_(lead['Company']),
      email: clean_(lead['Email']),
      lead: clean_(lead['Quote Reference']) || clean_(lead['Brief Requirement']) || clean_(intake['Technical Scope']) || clean_(lead['Project Type']) || 'Partner assessment',
      projectType: clean_(lead['Project Type']) || clean_(intake['Service Type']),
      briefRequirement: clean_(lead['Brief Requirement']),
      technicalRequirement: clean_(intake['Technical Scope']),
      timelineUrgency: clean_(rawIntake.timelineUrgency || rawIntake.timeline_urgency || intake['Deadline'] || intake['Timing Notes']),
      filesDrawingsReady: clean_(rawIntake.filesDrawingsReady || rawIntake.files_drawings_ready || filesProvided),
      requirementComplexity: clean_(rawIntake.requirementComplexity || rawIntake.requirement_complexity || intake['Technical Notes']),
      filesProvided: filesProvided,
      fileLinks: fileLinks,
      lifecycleStatus: clean_(lead['Lifecycle Status']),
      reviewStatus: clean_(request['Partner Assessment Status']) || clean_(lead['Review Status']),
      requestStatus: clean_(request['Request Status']),
      status: clean_(request['Partner Assessment Status']) || clean_(request['Request Status']) || clean_(lead['Vendor Pricing Status']) || clean_(lead['Lifecycle Status']),
      submittedAt: toIso_(submittedAt),
      dateCreated: toIso_(lead['Created At'])
    };
  }

  function toPendingQualificationRecord_(lead, intake, review) {
    review = review || {};
    var reviewCreatedAt = review['Created At'] || review['Approved At'] || lead['Last Updated At'] || lead['Created At'];
    var base = intake ? toPendingReviewRecord_(lead, intake, null, null) : {
      leadId: clean_(lead['Lead ID']),
      technicalIntakeId: '',
      client: clean_(lead['Full Name']),
      personName: clean_(lead['Full Name']),
      company: clean_(lead['Company']),
      email: clean_(lead['Email']),
      lead: clean_(lead['Brief Requirement']) || clean_(lead['Project Type']) || 'Qualification decision',
      projectType: clean_(lead['Project Type']),
      briefRequirement: clean_(lead['Brief Requirement']),
      technicalRequirement: '',
      timelineUrgency: '',
      filesDrawingsReady: '',
      requirementComplexity: '',
      filesProvided: clean_(lead['Files Provided']),
      fileLinks: [],
      lifecycleStatus: clean_(lead['Lifecycle Status']),
      reviewStatus: clean_(lead['Review Status']),
      status: clean_(lead['Review Status']) || clean_(lead['Lifecycle Status']),
      submittedAt: toIso_(lead['Step 2 Completed At'] || lead['Last Updated At'] || lead['Created At']),
      dateCreated: toIso_(lead['Created At'])
    };

    base.technicalReviewId = clean_(review['Technical Review ID']);
    base.reviewer = clean_(review['Reviewer']);
    base.reviewerOrganisation = clean_(review['Reviewer Organisation']);
    base.reviewerEmail = clean_(review['Reviewer Email']);
    base.filesAndRevisionsReviewed = clean_(review['Files And Revisions Reviewed']);
    base.partnerReviewPackageLink = clean_(review['Partner Review Package Link']) || base.partnerReviewPackageLink || '';
    base.partnerAssessmentDocumentLink = clean_(review['Partner Assessment Document Link']);
    base.feasibilityStatus = clean_(review['Feasibility Status']);
    base.partnerSubmittedAt = toIso_(review['Partner Submitted At']);
    base.reviewSummary = clean_(review['Review Summary']);
    base.risks = parseReviewList_(review['Risks']);
    base.clarifications = parseReviewList_(review['Clarifications']);
    base.internalNotes = clean_(review['Internal Notes']);
    base.recommendation = clean_(review['Recommendation']);
    base.reviewedAt = toIso_(reviewCreatedAt);
    base.lifecycleStatus = clean_(lead['Lifecycle Status']);
    base.reviewStatus = clean_(lead['Review Status']);
    base.status = clean_(lead['Qualification Decision']) || clean_(lead['Review Status']) || clean_(lead['Lifecycle Status']);
    base.nextAction = clean_(lead['Next Action']);
    return base;
  }

  function toVendorSafeRecord_(lead, intake, review, vendorPackage) {
    var base = toPendingQualificationRecord_(lead, intake, review || {});
    base.packageId = vendorPackage ? clean_(vendorPackage['Package ID']) : '';
    base.packageStatus = vendorPackage ? clean_(vendorPackage['Package Status']) : clean_(lead['Vendor Pricing Status']) || 'Vendor Safe Package Required';
    base.vendorSafePackageReady = clean_(lead['Vendor Safe Package Ready']);
    base.driveFolderStatus = clean_(lead['Drive Folder Status']);
    base.vendorPricingStatus = clean_(lead['Vendor Pricing Status']);
    base.readyAt = toIso_(vendorPackage && vendorPackage['Created At'] || lead['Decision Timestamp'] || lead['Last Updated At'] || lead['Created At']);
    base.status = base.packageStatus || base.status;
    return base;
  }

  function toVendorRequestRecord_(lead, intake, review, vendorPackage, request) {
    var base = review && clean_(review['Technical Review ID']) ? toPendingQualificationRecord_(lead, intake, review) : toPendingReviewRecord_(lead, intake || {}, request || {}, vendorPackage || {});
    base.packageId = vendorPackage ? clean_(vendorPackage['Package ID']) : '';
    base.packageStatus = vendorPackage ? clean_(vendorPackage['Package Status']) : '';
    base.packageLink = vendorPackage ? clean_(vendorPackage['Drive Folder URL']) : base.packageLink || '';
    base.vendorPricingStatus = clean_(lead['Vendor Pricing Status']);
    base.vendorSafePackageReady = clean_(lead['Vendor Safe Package Ready']);
    base.requestId = request ? clean_(request['Request ID']) : '';
    base.requestStatus = request ? clean_(request['Request Status']) : '';
    base.technicalReviewId = base.technicalReviewId || (request ? clean_(request['Technical Review ID']) : '');
    base.reviewerOrganisation = base.reviewerOrganisation || (request ? clean_(request['Reviewer Organisation']) : '');
    base.filesAndRevisionsPriced = request ? clean_(request['Files And Revisions Priced']) : base.filesAndRevisionsReviewed || '';
    base.sourcePackageId = request ? clean_(request['Source Package ID']) : base.packageId;
    base.scopeRevision = request ? clean_(request['Scope Revision']) : '';
    base.readyAt = toIso_(vendorPackage && vendorPackage['Approved At'] || lead['Last Updated At'] || lead['Created At']);
    base.status = clean_(lead['Vendor Pricing Status']) || clean_(lead['Quote Status']) || 'Contact Vendor';
    return base;
  }

  function toQuoteBuilderRecord_(lead, intake, pricing, vendorPackage) {
    return {
      leadId: clean_(lead['Lead ID']),
      lead: clean_(lead['Brief Requirement']) || clean_(lead['Project Type']) || 'Quote builder',
      client: clean_(lead['Full Name']),
      company: clean_(lead['Company']),
      email: clean_(lead['Email']),
      projectType: clean_(lead['Project Type']) || clean_(intake && intake['Service Type']),
      briefRequirement: clean_(lead['Brief Requirement']),
      technicalRequirement: clean_(intake && intake['Technical Scope']),
      quoteReference: clean_(pricing['Quote Reference'] || lead['Quote Reference']),
      pricingId: clean_(pricing['Pricing ID']),
      vendorName: clean_(pricing['Vendor Name']),
      vendorEmail: clean_(pricing['Vendor Email']),
      vendorCost: clean_(pricing['Vendor Cost']),
      vendorCurrency: clean_(pricing['Vendor Currency']),
      marginType: clean_(pricing['Margin Type']),
      marginValue: clean_(pricing['Margin Value']),
      midtsProfitAmount: clean_(pricing['MIDTS Profit Amount']),
      clientQuoteAmount: clean_(pricing['Client Quote Amount']),
      clientQuoteCurrency: clean_(pricing['Client Quote Currency'] || pricing['Vendor Currency']),
      quoteRevision: clean_(pricing['Quote Revision']),
      pricingStatus: clean_(pricing['Pricing Status']),
      pricingApprovedAt: toIso_(pricing['Pricing Approved At']),
      marginApprovedAt: toIso_(pricing['Pricing Approved At'] || lead['Last Updated At']),
      packageId: vendorPackage ? clean_(vendorPackage['Package ID']) : '',
      packageLink: vendorPackage ? clean_(vendorPackage['Drive Folder URL']) : '',
      lifecycleStatus: clean_(lead['Lifecycle Status']),
      quoteStatus: clean_(lead['Quote Status']),
      vendorPricingStatus: clean_(lead['Vendor Pricing Status']),
      nextAction: clean_(lead['Next Action']),
      status: clean_(lead['Quote Status']) || clean_(lead['Lifecycle Status']),
      dateCreated: toIso_(lead['Created At'])
    };
  }

  function step2Complete_(lead) {
    return equivalent_(lead['Step 2 Status'], ['completed']) || equivalent_(lead['Status'], ['step 2 completed']) || Boolean(lead['Step 2 Completed At']);
  }

  function technicalReviewComplete_(lead, review) {
    return equivalent_(lead['Review Status'], ['partner technical assessment complete', 'technical review complete', 'completed', 'complete', 'approved', 'assessment received']) || Boolean(review && review['Technical Review ID']);
  }

  function qualificationDecisionComplete_(lead) {
    return clean_(lead['Human Approval']) === 'Approved' || Boolean(clean_(lead['Qualification Decision']));
  }

  function vendorSafePackagePending_(lead, vendorPackage) {
    if (!isYes_(lead['Vendor Safe Package Required'])) return false;
    if (isYes_(lead['Vendor Safe Package Ready'])) return false;
    if (vendorPackage && clean_(vendorPackage['Package Status']) === 'Approved for Vendor Pricing') return false;
    return equivalent_(lead['Lifecycle Status'], ['vendor safe review']) || equivalent_(lead['Vendor Pricing Status'], ['vendor safe package required']);
  }

  function vendorRequestSetupPending_(lead, request) {
    if (!isYes_(lead['Vendor Pricing Required'])) return false;
    if (request && ['Pending Send', 'Sent', 'Assessment Received'].indexOf(clean_(request['Request Status'])) !== -1) return false;
    if (isYes_(lead['Vendor Safe Package Required']) && !isYes_(lead['Vendor Safe Package Ready'])) return false;
    return equivalent_(lead['Vendor Pricing Status'], ['contact vendor', 'waiting vendor price']) || equivalent_(lead['Next Action'], ['contact vendor']);
  }

  function partnerAssessmentPending_(lead, request, review, vendorPackage) {
    if (!request || !clean_(request['Request ID'])) return false;
    if (partnerAssessmentPastCurrentStage_(lead)) return false;
    if (technicalReviewComplete_(lead, review)) return false;
    if (clean_(request['Technical Review ID'])) return false;
    if (['Sent', 'Assessment Requested', 'Pending Partner Assessment'].indexOf(clean_(request['Request Status'])) === -1) return false;
    if (!clean_(request['Vendor Package Link']) && !(vendorPackage && clean_(vendorPackage['Drive Folder URL']))) return false;
    return true;
  }

  function partnerAssessmentPastCurrentStage_(lead) {
    return equivalent_(lead['Lifecycle Status'], [
      'gross margin review',
      'margin review',
      'quote preparation',
      'quote draft',
      'quote approved',
      'quote sent',
      'quote accepted',
      'project active',
      'invoice issued',
      'closed',
      'nurture'
    ]);
  }

  function quoteBuilderPending_(lead) {
    if (!isYes_(lead['Quote Required'])) return false;
    if (clean_(lead['Lifecycle Status']) !== 'Quote Preparation') return false;
    if (clean_(lead['Quote Status']) !== 'Ready for Quote Draft') return false;
    return clean_(lead['Vendor Pricing Status']) === 'Margin Approved';
  }

  function isYes_(value) {
    return clean_(value).toLowerCase() === 'yes';
  }

  function equivalent_(value, expected) {
    var normalized = clean_(value).toLowerCase();
    return expected.indexOf(normalized) !== -1;
  }

  function normalizeCell_(value) {
    if (value instanceof Date) return toIso_(value);
    return clean_(value);
  }

  function toIso_(value) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (String(date) === 'Invalid Date') return clean_(value);
    return date.toISOString();
  }

  function splitList_(value) {
    var text = clean_(value);
    if (!text) return [];
    return text.split(/\r?\n|,|;/).map(clean_).filter(Boolean);
  }

  function parseReviewList_(value) {
    var text = clean_(value);
    if (!text) return [];
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(clean_).filter(Boolean);
    } catch (error) {}
    return splitList_(text);
  }

  function parseJson_(value) {
    try {
      return JSON.parse(clean_(value) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function clean_(value) {
    return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  return {
    listPendingTechnicalReviews: listPendingTechnicalReviews,
    listPendingQualificationDecisions: listPendingQualificationDecisions,
    listPendingVendorSafePackages: listPendingVendorSafePackages,
    listPendingVendorRequestSetups: listPendingVendorRequestSetups,
    listPendingQuoteBuilders: listPendingQuoteBuilders
  };
})();