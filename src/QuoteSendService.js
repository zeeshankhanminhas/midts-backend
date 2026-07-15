var MidtsQuoteSendService = (function () {
  function listPendingApprovedQuotes() {
    var leads = read_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var quotes = leads.filter(function (lead) {
      return clean_(lead['Lifecycle Status']) === 'Quote Approved' && clean_(lead['Quote Status']) === 'Approved to Send' && clean_(lead['Quote Reference']) && clean_(lead['Email']);
    }).map(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      var quoteReference = clean_(lead['Quote Reference']);
      var document = MidtsDocumentService.getClientReadyQuoteSnapshot(leadId, quoteReference);
      if (!document) return null;
      return toApprovedQuoteRecord_(lead, document.record);
    }).filter(Boolean);

    quotes.sort(function (a, b) {
      return Number(new Date(b.approvedAt || b.dateCreated || 0)) - Number(new Date(a.approvedAt || a.dateCreated || 0));
    });

    return { ok: true, count: quotes.length, quotes: quotes };
  }

  function sendApprovedQuote(input) {
    input = input || {};
    var leadId = clean_(input.leadId || input.lead_id);
    var sender = clean_(input.sender || input.reviewer || input.actor) || 'MIDTS Quote Sender';
    var clientMessage = clean_(input.clientMessage || input.client_message || input.message);
    if (!leadId) return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required to send an approved quote.' };

    var existingLead = MidtsSheetService.findLeadById(leadId);
    if (!existingLead) return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };

    var lead = existingLead.lead;
    var quoteReference = clean_(lead['Quote Reference']);
    var recipient = clean_(lead['Email']);
    if (!quoteReference) return { ok: false, code: 'QUOTE_REFERENCE_MISSING', message: 'Quote reference is required before sending a quote.' };
    if (!recipient) return { ok: false, code: 'QUOTE_RECIPIENT_MISSING', message: 'Client email is required before sending a quote.' };

    if (clean_(lead['Quote Status']) === 'Sent to Client') {
      return {
        ok: true,
        alreadySent: true,
        leadId: leadId,
        quoteReference: quoteReference,
        quoteStatus: clean_(lead['Quote Status']),
        lifecycleStatus: clean_(lead['Lifecycle Status']),
        quoteSentAt: formatDate_(lead['Quote Sent At']),
        message: 'Quote has already been sent to the client.'
      };
    }

    var guard = guardLeadReadyToSend_(lead);
    if (!guard.ok) return guard;

    var document = MidtsDocumentService.getClientReadyQuoteSnapshot(leadId, quoteReference);
    if (!document) return { ok: false, code: 'QUOTE_PDF_NOT_READY', message: 'Client-ready quote PDF was not found. Approve the quote draft and generate the PDF before sending.' };

    var emailResult = MidtsEmailService.sendApprovedQuoteEmail({
      leadId: leadId,
      lead: sheetLeadToEmailLead_(lead),
      submissionId: clean_(lead['Submission ID'])
    }, document.record, sender, clientMessage);
    if (!emailResult.ok) return { ok: false, code: 'QUOTE_EMAIL_SEND_FAILED', message: emailResult.message };

    var sentDocument = MidtsDocumentService.markQuoteSnapshotSent(leadId, quoteReference, recipient);
    if (!sentDocument.ok) return { ok: false, code: 'QUOTE_DOCUMENT_SENT_AUDIT_FAILED', message: sentDocument.message };

    var now = new Date();
    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Lifecycle Status': 'Quote Sent',
      'Next Action': 'Await client acceptance',
      'Next Action Due': now,
      'Quote Status': 'Sent to Client',
      'Quote Sent At': now,
      'Reviewer': sender,
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'QUOTE-SEND-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'quote_sent_to_client',
      message: 'Approved quote PDF sent to client from Workspace',
      payload: {
        leadId: leadId,
        quoteReference: quoteReference,
        recipient: recipient,
        documentId: sentDocument.documentId,
        driveFileId: clean_(document.record['Drive File ID']),
        driveUrl: clean_(document.record['Drive URL']),
        sender: sender
      },
      submissionId: clean_(updatedLead.lead['Submission ID']),
      email: recipient,
      source: 'Quote Send Service'
    });

    return {
      ok: true,
      leadId: leadId,
      quoteReference: quoteReference,
      recipient: recipient,
      quoteDocumentLink: clean_(document.record['Drive URL']),
      quoteStatus: 'Sent to Client',
      lifecycleStatus: 'Quote Sent',
      nextAction: 'Await client acceptance',
      quoteSentAt: now.toISOString()
    };
  }

  function guardLeadReadyToSend_(lead) {
    if (clean_(lead['Lifecycle Status']) !== 'Quote Approved') {
      return { ok: false, code: 'LEAD_NOT_QUOTE_APPROVED', message: 'Lead lifecycle must be Quote Approved before sending the quote.' };
    }
    if (clean_(lead['Quote Status']) !== 'Approved to Send') {
      return { ok: false, code: 'QUOTE_NOT_APPROVED_TO_SEND', message: 'Quote status must be Approved to Send before client release.' };
    }
    return { ok: true };
  }

  function toApprovedQuoteRecord_(lead, document) {
    return {
      leadId: clean_(lead['Lead ID']),
      client: clean_(lead['Full Name']),
      company: clean_(lead['Company']),
      email: clean_(lead['Email']),
      projectType: clean_(lead['Project Type']),
      briefRequirement: clean_(lead['Brief Requirement']),
      quoteReference: clean_(lead['Quote Reference'] || document['Quote Reference']),
      quoteDocumentLink: clean_(document['Drive URL'] || lead['Quote Document Link']),
      quoteDocumentId: clean_(document['Document ID']),
      quoteDriveFileId: clean_(document['Drive File ID']),
      documentStatus: clean_(document['Status']),
      lifecycleStatus: clean_(lead['Lifecycle Status']),
      quoteStatus: clean_(lead['Quote Status']),
      nextAction: clean_(lead['Next Action']),
      approvedAt: formatDate_(document['Approved At'] || lead['Last Updated At']),
      approvedBy: clean_(document['Approved By']),
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

  function sheetLeadToEmailLead_(sheetLead) {
    return {
      submissionId: clean_(sheetLead['Submission ID']),
      fullName: clean_(sheetLead['Full Name']) || 'there',
      email: clean_(sheetLead['Email']),
      company: clean_(sheetLead['Company']),
      projectType: clean_(sheetLead['Project Type']),
      briefRequirement: clean_(sheetLead['Brief Requirement']),
      source: clean_(sheetLead['Source'])
    };
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
    listPendingApprovedQuotes: listPendingApprovedQuotes,
    sendApprovedQuote: sendApprovedQuote
  };
})();
