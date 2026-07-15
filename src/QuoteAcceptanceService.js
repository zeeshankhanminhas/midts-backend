var MidtsQuoteAcceptanceService = (function () {
  function listPendingQuoteAcceptances() {
    var leads = read_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var quotes = leads.filter(function (lead) {
      return clean_(lead['Lifecycle Status']) === 'Quote Sent' && clean_(lead['Quote Status']) === 'Sent to Client' && clean_(lead['Quote Reference']) && clean_(lead['Email']);
    }).map(function (lead) {
      var document = MidtsDocumentService.getClientReadyQuoteSnapshot(clean_(lead['Lead ID']), clean_(lead['Quote Reference']));
      return toPendingAcceptanceRecord_(lead, document && document.record);
    });

    quotes.sort(function (a, b) {
      return Number(new Date(b.quoteSentAt || b.dateCreated || 0)) - Number(new Date(a.quoteSentAt || a.dateCreated || 0));
    });

    return { ok: true, count: quotes.length, quotes: quotes };
  }

  function acceptQuote(input) {
    input = input || {};
    var leadId = clean_(input.leadId || input.lead_id);
    var acceptedBy = clean_(input.acceptedBy || input.accepted_by || input.reviewer || input.actor) || 'MIDTS Workspace';
    var acceptanceSource = clean_(input.acceptanceSource || input.acceptance_source || input.source) || 'Workspace';
    var notes = clean_(input.notes || input.acceptanceNotes || input.acceptance_notes);
    if (!leadId) return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required to accept a quote.' };

    var existingLead = MidtsSheetService.findLeadById(leadId);
    if (!existingLead) return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };

    var lead = existingLead.lead;
    var quoteReference = clean_(lead['Quote Reference']);
    if (!quoteReference) return { ok: false, code: 'QUOTE_REFERENCE_MISSING', message: 'Quote reference is required before quote acceptance.' };

    if (clean_(lead['Lifecycle Status']) === 'Quote Accepted' && clean_(lead['Quote Status']) === 'Accepted') {
      return {
        ok: true,
        alreadyAccepted: true,
        leadId: leadId,
        quoteReference: quoteReference,
        quoteStatus: clean_(lead['Quote Status']),
        lifecycleStatus: clean_(lead['Lifecycle Status']),
        nextAction: clean_(lead['Next Action']),
        acceptedAt: formatDate_(lead['Decision Timestamp']),
        message: 'Quote has already been accepted.'
      };
    }

    var guard = guardLeadReadyForAcceptance_(lead);
    if (!guard.ok) return guard;

    var document = MidtsDocumentService.getClientReadyQuoteSnapshot(leadId, quoteReference);
    if (!document || clean_(document.record['Status']) !== 'Sent') {
      return { ok: false, code: 'QUOTE_NOT_SENT', message: 'The generated quote PDF must be sent before acceptance can be recorded.' };
    }

    var now = new Date();
    var acceptanceId = 'QAC-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    MidtsSheetService.appendQuoteAcceptanceRow([
      acceptanceId,
      leadId,
      quoteReference,
      now,
      acceptedBy,
      acceptanceSource,
      clean_(lead['Email']),
      clean_(document.record['Drive URL'] || lead['Quote Document Link']),
      notes,
      JSON.stringify(scrubAcceptancePayload_(input))
    ]);

    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Lifecycle Status': 'Quote Accepted',
      'Quote Status': 'Accepted',
      'Human Approval': 'Approved',
      'Final Outcome': 'Quote Accepted',
      'Decision Timestamp': now,
      'Next Action': 'Create project',
      'Next Action Due': now,
      'Review Notes': notes,
      'Reviewer': acceptedBy,
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'QUOTE-ACCEPT-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'quote_accepted',
      message: 'Quote acceptance recorded from Workspace',
      payload: {
        leadId: leadId,
        quoteReference: quoteReference,
        acceptanceId: acceptanceId,
        acceptedBy: acceptedBy,
        acceptanceSource: acceptanceSource,
        quoteDocumentLink: clean_(document.record['Drive URL'] || '')
      },
      submissionId: clean_(updatedLead.lead['Submission ID']),
      email: clean_(updatedLead.lead['Email']),
      source: 'Quote Acceptance Service'
    });

    return {
      ok: true,
      acceptanceId: acceptanceId,
      leadId: leadId,
      quoteReference: quoteReference,
      lifecycleStatus: 'Quote Accepted',
      quoteStatus: 'Accepted',
      nextAction: 'Create project',
      acceptedAt: now.toISOString(),
      acceptedBy: acceptedBy,
      acceptanceSource: acceptanceSource
    };
  }

  function guardLeadReadyForAcceptance_(lead) {
    if (clean_(lead['Lifecycle Status']) !== 'Quote Sent') {
      return { ok: false, code: 'LEAD_NOT_QUOTE_SENT', message: 'Lead lifecycle must be Quote Sent before acceptance can be recorded.' };
    }
    if (clean_(lead['Quote Status']) !== 'Sent to Client') {
      return { ok: false, code: 'QUOTE_NOT_SENT_TO_CLIENT', message: 'Quote status must be Sent to Client before acceptance can be recorded.' };
    }
    return { ok: true };
  }

  function toPendingAcceptanceRecord_(lead, document) {
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
      quoteSentAt: formatDate_(lead['Quote Sent At'] || document && document['Sent At']),
      sentTo: clean_(document && document['Sent To'] || lead['Email']),
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

  function scrubAcceptancePayload_(payload) {
    var copy = Object.assign({}, payload || {});
    ['webhookToken', 'webhook_token', 'formToken', 'token', 'WEBSITE_WEBHOOK_TOKEN'].forEach(function (key) {
      if (copy[key]) copy[key] = '[redacted]';
    });
    return copy;
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

  return {
    listPendingQuoteAcceptances: listPendingQuoteAcceptances,
    acceptQuote: acceptQuote
  };
})();
