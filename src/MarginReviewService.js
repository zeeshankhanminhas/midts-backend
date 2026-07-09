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

  function updateMarginReview(payload) {
    var normalized = normalizeMarginUpdatePayload_(payload || {});
    var validation = validateMarginUpdate_(normalized);
    if (!validation.ok) return validation;

    var existingLead = MidtsSheetService.findLeadById(normalized.leadId);
    if (!existingLead) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + normalized.leadId };
    }

    var leadGuard = guardLeadInMarginReview_(existingLead.lead);
    if (!leadGuard.ok) return leadGuard;

    var latestPricing = MidtsSheetService.findLatestVendorPricingByLeadId(normalized.leadId);
    if (!latestPricing) {
      return { ok: false, code: 'VENDOR_PRICING_NOT_FOUND', message: 'No vendor pricing row found for lead: ' + normalized.leadId };
    }

    if (clean_(latestPricing.pricing['Pricing Status']) !== 'Margin Review Required') {
      return { ok: false, code: 'PRICING_NOT_IN_MARGIN_REVIEW', message: 'Latest vendor pricing must be in Margin Review Required before margin adjustment.' };
    }

    if (isYes_(latestPricing.pricing['Pricing Approved'])) {
      return { ok: false, code: 'MARGIN_ALREADY_APPROVED', message: 'Latest pricing revision is already approved.' };
    }

    var vendorCost = parseMoney_(latestPricing.pricing['Vendor Cost']);
    if (vendorCost === null) {
      return { ok: false, code: 'VENDOR_COST_MISSING', message: 'Vendor cost is missing on latest pricing revision.' };
    }

    var vendorCurrency = clean_(latestPricing.pricing['Vendor Currency']).toUpperCase();
    var clientQuoteCurrency = clean_(latestPricing.pricing['Client Quote Currency'] || latestPricing.pricing['Vendor Currency']).toUpperCase();
    if (vendorCurrency && clientQuoteCurrency && vendorCurrency !== clientQuoteCurrency) {
      return { ok: false, code: 'CURRENCY_CONVERSION_REQUIRED', message: 'Currency conversion is not in scope. Vendor and client currency must match before margin adjustment.' };
    }

    var calculated = calculateClientPrice_(vendorCost, normalized.marginType, normalized.marginValue);
    var now = new Date();
    var actor = normalized.reviewer || 'MIDTS Margin Reviewer';
    var reason = normalized.marginReason || 'Standard 30% margin confirmed.';
    var reasonNote = appendDecisionNote_(latestPricing.pricing['Notes'], 'Margin adjusted', actor, reason, now);
    var revisionReason = appendRevisionReason_(latestPricing.pricing['Revision Reason'], normalized.marginValue, reason, actor, now);

    var updatedPricing = MidtsSheetService.updateVendorPricingByPricingId(latestPricing.pricing['Pricing ID'], {
      'Margin Type': calculated.marginType,
      'Margin Value': calculated.marginValue,
      'MIDTS Profit Amount': calculated.midtsProfitAmount,
      'Client Quote Amount': calculated.clientQuoteAmount,
      'Pricing Status': 'Margin Review Required',
      'Pricing Approved': 'No',
      'Revision Reason': revisionReason,
      'Notes': reasonNote,
      'Last Updated At': now,
      'Client Quote Currency': clientQuoteCurrency || vendorCurrency
    });

    var updatedLead = MidtsSheetService.updateLeadById(normalized.leadId, {
      'Lifecycle Status': 'Margin Review',
      'Next Action': 'Approve margin',
      'Next Action Due': now,
      'Quote Status': 'Margin Review Required',
      'Vendor Pricing Status': 'Pricing Received',
      'Reviewer': actor,
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'MARGIN-UPDATE-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'margin_adjusted',
      message: 'Margin adjusted in Workspace; latest vendor pricing row updated in place',
      payload: {
        leadId: normalized.leadId,
        pricingId: latestPricing.pricing['Pricing ID'],
        marginType: calculated.marginType,
        marginValue: calculated.marginValue,
        midtsProfitAmount: calculated.midtsProfitAmount,
        clientQuoteAmount: calculated.clientQuoteAmount,
        reviewer: actor,
        marginReason: reason
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Margin Review Service'
    });

    return {
      ok: true,
      leadId: normalized.leadId,
      pricingId: updatedPricing.pricing['Pricing ID'],
      quoteReference: updatedPricing.pricing['Quote Reference'] || '',
      vendorCost: vendorCost,
      vendorCurrency: vendorCurrency,
      clientQuoteCurrency: clientQuoteCurrency || vendorCurrency,
      marginType: calculated.marginType,
      marginValue: calculated.marginValue,
      midtsProfitAmount: calculated.midtsProfitAmount,
      clientQuoteAmount: calculated.clientQuoteAmount,
      pricingStatus: 'Margin Review Required',
      pricingApproved: 'No',
      quoteStatus: 'Margin Review Required',
      lifecycleStatus: 'Margin Review',
      vendorPricingStatus: 'Pricing Received',
      nextAction: 'Approve margin'
    };
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

    var leadGuard = guardLeadInMarginReview_(existingLead.lead);
    if (!leadGuard.ok) return leadGuard;

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

  function normalizeMarginUpdatePayload_(payload) {
    return {
      leadId: clean_(payload.leadId || payload.lead_id),
      marginType: clean_(payload.marginType || payload.margin_type || 'percentage').toLowerCase(),
      marginValue: parseMoney_(payload.marginValue || payload.margin_value),
      marginReason: clean_(payload.marginReason || payload.margin_reason || payload.internalNotes || payload.notes),
      reviewer: clean_(payload.reviewer || payload.actor)
    };
  }

  function validateMarginUpdate_(payload) {
    if (!payload.leadId) return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required for margin adjustment.' };
    if (!payload.reviewer) return { ok: false, code: 'MISSING_REVIEWER', message: 'Reviewer is required for margin adjustment.' };
    if (payload.marginValue === null) return { ok: false, code: 'INVALID_MARGIN_VALUE', message: 'Margin must be numeric.' };
    if (payload.marginType !== 'percentage') return { ok: false, code: 'UNSUPPORTED_MARGIN_TYPE', message: 'Only percentage margin adjustment is currently supported.' };
    if (payload.marginValue < 0 || payload.marginValue > 100) return { ok: false, code: 'MARGIN_OUT_OF_RANGE', message: 'Percentage margin must be between 0 and 100.' };
    if ((payload.marginValue < 20 || payload.marginValue > 40 || payload.marginValue !== 30) && !payload.marginReason) {
      return { ok: false, code: 'MARGIN_REASON_REQUIRED', message: 'Override reason is required when margin is not the standard 30%.' };
    }
    return { ok: true };
  }

  function guardLeadInMarginReview_(lead) {
    if (clean_(lead['Lifecycle Status']) !== 'Margin Review') {
      return { ok: false, code: 'LEAD_NOT_IN_MARGIN_REVIEW', message: 'Lead lifecycle must be Margin Review before changing margin outcome.' };
    }
    if (clean_(lead['Quote Status']) !== 'Margin Review Required') {
      return { ok: false, code: 'QUOTE_NOT_IN_MARGIN_REVIEW', message: 'Quote status must be Margin Review Required before changing margin outcome.' };
    }
    if (clean_(lead['Vendor Pricing Status']) !== 'Pricing Received') {
      return { ok: false, code: 'VENDOR_PRICING_NOT_RECEIVED', message: 'Vendor pricing must be received before changing margin outcome.' };
    }
    return { ok: true };
  }

  function calculateClientPrice_(vendorCost, marginType, marginValue) {
    var safeMarginType = clean_(marginType).toLowerCase() === 'fixed' ? 'fixed' : 'percentage';
    var safeMarginValue = marginValue === null ? 30 : marginValue;
    var profitAmount = safeMarginType === 'fixed' ? safeMarginValue : vendorCost * (safeMarginValue / 100);
    return {
      marginType: safeMarginType,
      marginValue: roundMoney_(safeMarginValue),
      midtsProfitAmount: roundMoney_(profitAmount),
      clientQuoteAmount: roundMoney_(vendorCost + profitAmount)
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

  function appendRevisionReason_(current, marginValue, reason, actor, date) {
    var stamp = Utilities.formatDate(date || new Date(), 'Europe/London', 'yyyy-MM-dd HH:mm');
    var text = '[' + stamp + '] Margin set to ' + roundMoney_(marginValue) + '% by ' + clean_(actor) + ': ' + clean_(reason);
    var existing = clean_(current);
    return existing ? existing + '\n' + text : text;
  }

  function parseMoney_(value) {
    if (value === null || value === undefined || value === '') return null;
    var parsed = Number(String(value).replace(/,/g, '').trim());
    return isFinite(parsed) ? parsed : null;
  }

  function roundMoney_(value) { return Math.round(Number(value || 0) * 100) / 100; }
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
    updateMarginReview: updateMarginReview,
    approveMargin: approveMargin,
    rejectMargin: rejectMargin,
    returnMarginToVendor: returnMarginToVendor
  };
})();
