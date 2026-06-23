var MidtsProjectService = (function () {
  function createProjectFromAcceptedQuote(leadId, creator) {
    if (!leadId) return { ok:false, code:'MISSING_LEAD_ID', message:'Lead ID is required.' };
    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok:false, code:'LEAD_NOT_FOUND', message:'Lead not found: ' + leadId };
    var lead = leadResult.lead;
    if (String(lead['Lifecycle Status'] || '') !== 'Quote Accepted' || String(lead['Quote Status'] || '') !== 'Accepted') {
      return { ok:false, code:'QUOTE_NOT_ACCEPTED', message:'An accepted quote is required before project creation.' };
    }
    var existing = MidtsSheetService.findProjectByLeadId(leadId);
    if (existing) return { ok:true, alreadyCreated:true, projectId:existing.project['Project ID'], driveFolderUrl:existing.project['Drive Folder URL'] };
    var now = new Date();
    var projectId = 'PRJ-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random()*9000+1000);
    var structure = MidtsDriveService.ensureLeadStructure(leadId);
    var document = MidtsDocumentService.getClientReadyQuoteSnapshot(leadId, lead['Quote Reference']);
    MidtsSheetService.appendProjectRow([projectId,leadId,lead['Quote Reference']||'',now,creator||'MIDTS Project Control','Open',structure.leadFolderUrl,document?document.record['Document ID']:'',now]);
    MidtsSheetService.updateLeadById(leadId, {'Lifecycle Status':'Project Active','Next Action':'Plan project delivery','Next Action Due':now,'Final Outcome':'Quote Accepted','Last Updated At':now});
    return { ok:true, projectId:projectId, driveFolderUrl:structure.leadFolderUrl, nextAction:'Plan project delivery' };
  }
  return { createProjectFromAcceptedQuote:createProjectFromAcceptedQuote };
})();