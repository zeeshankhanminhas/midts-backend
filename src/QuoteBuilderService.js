var MidtsQuoteBuilderService = (function () {
  function listPendingQuoteBuilders() {
    var leads = readSheetObjects_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var pricingRows = readSheetObjects_(MidtsSheetService.SHEETS.VENDOR_PRICING, MidtsSheetService.VENDOR_PRICING_HEADERS);
    var intakes = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_INTAKE, MidtsSheetService.TECHNICAL_INTAKE_HEADERS);
    var packages = readSheetObjects_(MidtsSheetService.SHEETS.VENDOR_SAFE_PACKAGES, MidtsSheetService.VENDOR_SAFE_PACKAGE_HEADERS);

    var latestPricingByLead = latestByLeadId_(pricingRows, 'Last Updated At');
    var latestIntakeByLead = latestByLeadId_(intakes, 'Completed At');
    var latestPackageByLead = latestByLeadId_(packages, 'Created At');

    var quotes = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      if (!leadId) return false;
      if (clean_(lead['Lifecycle Status']) !== 'Quote Preparation') return false;
      if (clean_(lead['Quote Status']) !== 'Ready for Quote Draft') return false;
      if (clean_(lead['Vendor Pricing Status']) !== 'Margin Approved') return false;
      var pricing = latestPricingByLead[leadId];
      return pricing && isYes_(pricing['Pricing Approved']) && clean_(pricing['Pricing Status']) === 'Margin Approved';
    }).map(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      return toQuoteBuilderRecord_(lead, latestPricingByLead[leadId], latestIntakeByLead[leadId], latestPackageByLead[leadId]);
    });

    quotes.sort(function (a, b) {
      return Number(new Date(b.pricingApprovedAt || b.dateCreated || 0)) - Number(new Date(a.pricingApprovedAt || a.dateCreated || 0));
    });

    return { ok:true, count:quotes.length, quotes:quotes };
  }

  function prepareQuoteDraft(leadId, preparer) {
    return MidtsQuoteService.prepareQuoteDraft(leadId, preparer || 'MIDTS Quote Builder');
  }

  function toQuoteBuilderRecord_(lead, pricing, intake, vendorPackage) {
    return {
      leadId: clean_(lead['Lead ID']),
      lead: clean_(lead['Brief Requirement']) || clean_(lead['Project Type']) || 'Quote builder',
      client: clean_(lead['Full Name']),
      company: clean_(lead['Company']),
      email: clean_(lead['Email']),
      projectType: clean_(lead['Project Type']),
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
      marginApprovedAt: toIso_(pricing['Pricing Approved At']),
      packageId: clean_(vendorPackage && vendorPackage['Package ID']),
      packageLink: clean_(vendorPackage && vendorPackage['Drive Folder URL']),
      lifecycleStatus: clean_(lead['Lifecycle Status']),
      quoteStatus: clean_(lead['Quote Status']),
      vendorPricingStatus: clean_(lead['Vendor Pricing Status']),
      nextAction: clean_(lead['Next Action']),
      status: clean_(lead['Quote Status']) || clean_(lead['Lifecycle Status']),
      dateCreated: toIso_(lead['Created At']),
      quoteDocumentLink: clean_(lead['Quote Document Link'])
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

  function latestByLeadId_(rows, dateHeader) {
    return rows.reduce(function (map, row) {
      var leadId = clean_(row['Lead ID']);
      if (!leadId) return map;
      var existing = map[leadId];
      var isLatestRevision = isYes_(row['Latest Revision']);
      if (!existing || isLatestRevision || Number(new Date(row[dateHeader] || 0)) >= Number(new Date(existing[dateHeader] || 0))) map[leadId] = row;
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
  function isYes_(value) { var normalized = clean_(value).toLowerCase(); return normalized === 'yes' || normalized === 'true' || normalized === 'approved'; }
  function clean_(value) { return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim(); }

  return { listPendingQuoteBuilders:listPendingQuoteBuilders, prepareQuoteDraft:prepareQuoteDraft };
})();
