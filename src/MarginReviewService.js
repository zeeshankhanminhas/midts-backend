var MidtsMarginReviewService = (function () {
  function listPendingMarginReviews() {
    var leads = readSheetObjects_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var pricingRows = readSheetObjects_(MidtsSheetService.SHEETS.VENDOR_PRICING, MidtsSheetService.VENDOR_PRICING_HEADERS);
    var latestPricingByLead = latestPricingByLeadId_(pricingRows);

    var margins = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      if (!leadId) return false;
      if (clean_(lead['Lifecycle Status']) !== 'Margin Review') return false;
      if (clean_(lead['Quote Status']) !== 'Margin Review Required') return false;
      if (clean_(lead['Vendor Pricing Status']) !== 'Pricing Received') return false;
      var pricing = latestPricingByLead[leadId];
      return pricing && clean_(pricing['Pricing Status']) === 'Margin Review Required' && !isYes_(pricing['Pricing Approved']);
    }).map(function (lead) {
      return toMarginRecord_(lead, latestPricingByLead[clean_(lead['Lead ID'])]);
    });

    margins.sort(function (a, b) {
      return Number(new Date(b.pricingCreatedAt || b.dateCreated || 0)) - Number(new Date(a.pricingCreatedAt || a.dateCreated || 0));
    });

    return { ok:true, count:margins.length, margins:margins };
  }

  function approveMargin(leadId, approver) {
    return MidtsVendorPricingService.approveLatestMargin(leadId, approver || 'MIDTS Margin Reviewer');
  }

  function rejectMargin(leadId, reviewer, notes) {
    return closeMarginReview_(leadId, reviewer, notes, {
      pricingStatus: 'Margin Rejected',
      lifecycleStatus: 'Vendor Pricing',
      nextAction: 'Review rejected margin',
      quoteStatus: 'Margin Rejected',
      vendorPricingStatus: 'Margin Rejected',
      outcome: 'margin_rejected',
      message: 'Margin rejected; lead returned to vendor pricing control.'
    });
  }

  function returnMarginToVendor(leadId, reviewer, notes) {
    return closeMarginReview_(leadId, reviewer, notes, {
      pricingStatus: 'Returned to Vendor',
      lifecycleStatus: 'Vendor Pricing',
      nextAction: 'Contact vendor',
      quoteStatus: 'Waiting Vendor Price',
      vendorPricingStatus: 'Contact Vendor',
      outcome: 'margin_returned_to_vendor',
      message: 'Margin returned to vendor pricing for revised information.'
    });
  }

  function closeMarginReview_(leadId, reviewer, notes, state) {
    if (!leadId) {
      return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required for margin review.' };
    }

    var existingLead = MidtsSheetService.findLeadById(leadId);
    if (!existingLead) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    }

    if (clean_(existingLead.lead['Lifecycle Status']) !== 'Margin Review') {
      return { ok: false, code: 'LEAD_NOT_IN_MARGIN_REVIEW', message: 'Lead lifecycle must be Margin Review before changing margin outcome.' };
    }

    var latestPricing = MidtsSheetService.findLatestVendorPricingByLeadId(leadId);
    if (!latestPricing) {
      return { ok: false, code: 'VENDOR_PRICING_NOT_FOUND', message: 'No vendor pricing row found for lead: ' + leadId };
    }

    if (isYes_(latestPricing.pricing['Pricing Approved'])) {
      return { ok: false, code: 'MARGIN_ALREADY_APPROVED', message: 'Latest pricing revision is already approved.' };
    }

    var now = new Date();
    var actor = reviewer || 'MIDTS Margin Reviewer';
    var decisionNote = appendDecisionNote_(latestPricing.pricing['Notes'], state.pricingStatus, actor, notes, now);
    var reviewNote = appendDecisionNote_(existingLead.lead['Review Notes'], state.pricingStatus, actor, notes, now);
    var updatedPricing = MidtsSheetService.updateVendorPricingByPricingId(latestPricing.pricing['Pricing ID'], {
      'Pricing Status': state.pricingStatus,
      'Pricing Approved': 'No',
      'Notes': decisionNote,
      'Last Updated At': now
    });

    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Lifecycle Status': state.lifecycleStatus,
      'Next Action': state.nextAction,
      'Next Action Due': now,
      'Quote Status': state.quoteStatus,
      'Vendor Pricing Status': state.vendorPricingStatus,
      'Reviewer': actor,
      'Review Notes': reviewNote,
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'MARGIN-REVIEW-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: state.outcome,
      message: state.message,
      payload: {
        leadId: leadId,
        pricingId: latestPricing.pricing['Pricing ID'],
        quoteReference: latestPricing.pricing['Quote Reference'] || '',
        reviewer: actor,
        notes: notes || ''
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Margin Review Service'
    });

    return {
      ok: true,
      leadId: leadId,
      pricingId: updatedPricing.pricing['Pricing ID'],
      quoteReference: updatedPricing.pricing['Quote Reference'] || '',
      pricingStatus: state.pricingStatus,
      pricingApproved: 'No',
      quoteStatus: state.quoteStatus,
      lifecycleStatus: state.lifecycleStatus,
      nextAction: state.nextAction,
      vendorPricingStatus: state.vendorPricingStatus
    };
  }

  function toMarginRecord_(lead, pricing) {
    return {
      leadId: clean_(lead['Lead ID']),
      lead: clean_(lead['Brief Requirement']) || clean_(lead['Project Type']) || 'Margin review',
      client: clean_(lead['Full Name']),
      company: clean_(lead['Company']),
      email: clean_(lead['Email']),
      projectType: clean_(lead['Project Type']),
      briefRequirement: clean_(lead['Brief Requirement']),
      lifecycleStatus: clean_(lead['Lifecycle Status']),
      quoteStatus: clean_(lead['Quote Status']),
      vendorPricingStatus: clean_(lead['Vendor Pricing Status']),
      nextAction: clean_(lead['Next Action']),
      quoteReference: clean_(pricing['Quote Reference'] || lead['Quote Reference']),
      pricingId: clean_(pricing['Pricing ID']),
      pricingCreatedAt: toIso_(pricing['Created At']),
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
      notes: clean_(pricing['Notes']),
      internalNotes: clean_(lead['Review Notes']),
      dateCreated: toIso_(lead['Created At'])
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
      headers.forEach(function (header, index) { if (header) object[header] = normalizeCell_(row[index]); });
      expectedHeaders.forEach(function (header) { if (object[header] === undefined) object[header] = ''; });
      return object;
    });
  }

  function latestPricingByLeadId_(rows) {
    return rows.reduce(function (map, row) {
      var leadId = clean_(row['Lead ID']);
      if (!leadId) return map;
      var existing = map[leadId];
      var latestFlag = isYes_(row['Latest Revision']);
      if (!existing || latestFlag || Number(row['Quote Revision'] || 0) >= Number(existing['Quote Revision'] || 0)) map[leadId] = row;
      return map;
    }, {});
  }

  function appendDecisionNote_(current, status, actor, notes, date) {
    var stamp = Utilities.formatDate(date || new Date(), 'Europe/London', 'yyyy-MM-dd HH:mm');
    var text = '[' + stamp + '] ' + status + ' by ' + clean_(actor) + (notes ? ': ' + clean_(notes) : '');
    var existing = clean_(current);
    return existing ? existing + '\n' + text : text;
  }

  function normalizeCell_(value) { return value instanceof Date ? toIso_(value) : clean_(value); }
  function toIso_(value) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (String(date) === 'Invalid Date') return clean_(value);
    return date.toISOString();
  }
  function isYes_(value) { return clean_(value).toLowerCase() === 'yes' || clean_(value).toLowerCase() === 'true'; }
  function clean_(value) { return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim(); }

  return {
    listPendingMarginReviews: listPendingMarginReviews,
    approveMargin: approveMargin,
    rejectMargin: rejectMargin,
    returnMarginToVendor: returnMarginToVendor
  };
})();
