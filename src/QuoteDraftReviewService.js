var MidtsQuoteDraftReviewService = (function () {
  function listPendingQuoteDraftReviews() {
    var leads = read_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var pricingRows = read_(MidtsSheetService.SHEETS.VENDOR_PRICING, MidtsSheetService.VENDOR_PRICING_HEADERS);
    var latestPricing = latestByLead_(pricingRows);
    var quotes = leads.filter(function (lead) {
      return clean_(lead['Lifecycle Status']) === 'Quote Draft' && clean_(lead['Quote Status']) === 'Draft Prepared' && clean_(lead['Quote Document Link']);
    }).map(function (lead) {
      var pricing = latestPricing[clean_(lead['Lead ID'])] || {};
      return {
        leadId: clean_(lead['Lead ID']),
        client: clean_(lead['Full Name']),
        company: clean_(lead['Company']),
        email: clean_(lead['Email']),
        projectType: clean_(lead['Project Type']),
        briefRequirement: clean_(lead['Brief Requirement']),
        quoteReference: clean_(lead['Quote Reference'] || pricing['Quote Reference']),
        quoteDocumentLink: clean_(lead['Quote Document Link']),
        lifecycleStatus: clean_(lead['Lifecycle Status']),
        quoteStatus: clean_(lead['Quote Status']),
        nextAction: clean_(lead['Next Action']),
        vendorCost: clean_(pricing['Vendor Cost']),
        vendorCurrency: clean_(pricing['Vendor Currency']),
        marginType: clean_(pricing['Margin Type']),
        marginValue: clean_(pricing['Margin Value']),
        midtsProfitAmount: clean_(pricing['MIDTS Profit Amount']),
        clientQuoteAmount: clean_(pricing['Client Quote Amount']),
        clientQuoteCurrency: clean_(pricing['Client Quote Currency'] || pricing['Vendor Currency']),
        preparedAt: iso_(lead['Last Updated At'])
      };
    });
    return { ok:true, count:quotes.length, quotes:quotes };
  }

  function approveQuoteDraft(leadId, reviewer) {
    if (!leadId) return { ok:false, code:'MISSING_LEAD_ID', message:'Lead ID is required.' };
    return MidtsQuoteService.approveQuoteDraft(leadId, reviewer || 'MIDTS Quote Reviewer');
  }

  function read_(sheetName, expectedHeaders) {
    var id = MidtsConfig.getSpreadsheetId();
    var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss && ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(clean_);
    return sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues().map(function(row){
      var result={}; headers.forEach(function(header,index){ if(header) result[header]=row[index] instanceof Date ? row[index].toISOString() : clean_(row[index]); });
      expectedHeaders.forEach(function(header){ if(result[header]===undefined) result[header]=''; });
      return result;
    });
  }
  function latestByLead_(rows) { return rows.reduce(function(map,row){ var id=clean_(row['Lead ID']); if(!id)return map; var current=map[id]; if(!current || yes_(row['Latest Revision']) || Number(row['Quote Revision']||0) >= Number(current['Quote Revision']||0)) map[id]=row; return map; },{}); }
  function yes_(value){ var v=clean_(value).toLowerCase(); return v==='yes'||v==='true'||v==='approved'; }
  function iso_(value){ if(!value)return ''; var d=new Date(value); return String(d)==='Invalid Date' ? clean_(value) : d.toISOString(); }
  function clean_(value){ return String(value===undefined||value===null?'':value).replace(/\s+/g,' ').trim(); }
  return { listPendingQuoteDraftReviews:listPendingQuoteDraftReviews, approveQuoteDraft:approveQuoteDraft };
})();
