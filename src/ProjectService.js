var MidtsProjectService = (function () {
  function listPendingProjectCreations() {
    var leads = read_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var projects = read_(MidtsSheetService.SHEETS.PROJECTS, MidtsSheetService.PROJECT_HEADERS);
    var projectsByLead = projects.reduce(function (map, project) {
      var leadId = clean_(project['Lead ID']);
      if (leadId) map[leadId] = project;
      return map;
    }, {});

    var accepted = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      return leadId && clean_(lead['Lifecycle Status']) === 'Quote Accepted' && clean_(lead['Quote Status']) === 'Accepted' && !projectsByLead[leadId];
    }).map(function (lead) {
      var document = MidtsDocumentService.getClientReadyQuoteSnapshot(clean_(lead['Lead ID']), clean_(lead['Quote Reference']));
      return toPendingProjectRecord_(lead, document && document.record);
    });

    accepted.sort(function (a, b) {
      return Number(new Date(b.acceptedAt || b.dateCreated || 0)) - Number(new Date(a.acceptedAt || a.dateCreated || 0));
    });

    return { ok: true, count: accepted.length, projects: accepted };
  }

  function createProjectFromAcceptedQuote(leadId, creator) {
    if (!leadId) return { ok:false, code:'MISSING_LEAD_ID', message:'Lead ID is required.' };
    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok:false, code:'LEAD_NOT_FOUND', message:'Lead not found: ' + leadId };
    var lead = leadResult.lead;
    if (String(lead['Lifecycle Status'] || '') !== 'Quote Accepted' || String(lead['Quote Status'] || '') !== 'Accepted') {
      return { ok:false, code:'QUOTE_NOT_ACCEPTED', message:'An accepted quote is required before project creation.' };
    }
    var existing = MidtsSheetService.findProjectByLeadId(leadId);
    if (existing) return { ok:true, alreadyCreated:true, projectId:existing.project['Project ID'], driveFolderUrl:existing.project['Drive Folder URL'], nextAction:lead['Next Action'] || '' };
    var now = new Date();
    var projectId = 'PRJ-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random()*9000+1000);
    var structure = MidtsDriveService.ensureLeadStructure(leadId);
    var document = MidtsDocumentService.getClientReadyQuoteSnapshot(leadId, lead['Quote Reference']);
    var createdBy = creator || 'MIDTS Project Control';
    var sourceDocumentId = document ? document.record['Document ID'] : '';
    MidtsSheetService.appendProjectRow([projectId,leadId,lead['Quote Reference']||'',now,createdBy,'Open',structure.leadFolderUrl,sourceDocumentId,now]);
    var updatedLead = MidtsSheetService.updateLeadById(leadId, {'Lifecycle Status':'Project Active','Next Action':'Plan project delivery','Next Action Due':now,'Final Outcome':'Quote Accepted','Last Updated At':now});

    MidtsLogger.logWebhookAttempt({
      requestId: 'PROJECT-CREATE-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'project_created',
      message: 'Project created from accepted quote',
      payload: {
        leadId: leadId,
        projectId: projectId,
        quoteReference: lead['Quote Reference'] || '',
        driveFolderUrl: structure.leadFolderUrl,
        sourceDocumentId: sourceDocumentId,
        createdBy: createdBy
      },
      submissionId: clean_(updatedLead.lead['Submission ID']),
      email: clean_(updatedLead.lead['Email']),
      source: 'Project Service'
    });

    return { ok:true, leadId:leadId, projectId:projectId, quoteReference:lead['Quote Reference']||'', driveFolderUrl:structure.leadFolderUrl, sourceDocumentId:sourceDocumentId, lifecycleStatus:'Project Active', nextAction:'Plan project delivery' };
  }

  function toPendingProjectRecord_(lead, document) {
    return {
      leadId: clean_(lead['Lead ID']),
      client: clean_(lead['Full Name']),
      company: clean_(lead['Company']),
      email: clean_(lead['Email']),
      projectType: clean_(lead['Project Type']),
      briefRequirement: clean_(lead['Brief Requirement']),
      quoteReference: clean_(lead['Quote Reference']),
      quoteDocumentLink: clean_(document && document['Drive URL'] || lead['Quote Document Link']),
      quoteDocumentId: clean_(document && document['Document ID']),
      documentStatus: clean_(document && document['Status']),
      lifecycleStatus: clean_(lead['Lifecycle Status']),
      quoteStatus: clean_(lead['Quote Status']),
      nextAction: clean_(lead['Next Action']),
      acceptedAt: formatDate_(lead['Decision Timestamp'] || lead['Last Updated At']),
      dateCreated: formatDate_(lead['Created At'])
    };
  }

  function read_(sheetName, expectedHeaders) {
    var id = MidtsConfig.getSpreadsheetId();
    var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss && ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues().map(function (row) {
      var result = {};
      headers.forEach(function (header, index) { if (header) result[header] = row[index] instanceof Date ? row[index].toISOString() : clean_(row[index]); });
      expectedHeaders.forEach(function (header) { if (result[header] === undefined) result[header] = ''; });
      return result;
    });
  }

  function formatDate_(value) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (String(date) === 'Invalid Date') return clean_(value);
    return date.toISOString();
  }

  function clean_(value) {
    return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  return { listPendingProjectCreations:listPendingProjectCreations, createProjectFromAcceptedQuote:createProjectFromAcceptedQuote };
})();