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
    var result = MidtsVendorPricingService.approveLatestMargin(leadId, approver || 'MIDTS Margin Reviewer');
    return result;
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

  function normalizeCell_(value) { return value instanceof Date ? toIso_(value) : clean_(value); }
  function toIso_(value) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (String(date) === 'Invalid Date') return clean_(value);
    return date.toISOString();
  }
  function isYes_(value) { return clean_(value).toLowerCase() === 'yes' || clean_(value).toLowerCase() === 'true'; }
  function clean_(value) { return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim(); }

  return { listPendingMarginReviews:listPendingMarginReviews, approveMargin:approveMargin };
})();
