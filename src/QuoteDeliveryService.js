var MidtsQuoteDeliveryService = (function () {
  var SHEET_NAME = 'Quote Responses';
  var HEADERS = [
    'Response ID', 'Lead ID', 'Quote Reference', 'Created At', 'Sent At',
    'Client Email', 'Response Token Hash', 'Response Status', 'Responded At',
    'Client Outcome', 'Client Notes', 'Last Updated At'
  ];

  function sendQuoteSendEmail(leadId) {
    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok: false, message: 'Lead not found: ' + leadId };
    if (!isClientDeliveryEnabled_()) return { ok: false, message: 'Client quote delivery is disabled until a client-specific quote document is available.' };
    if (!isReadyToSend_(leadResult.lead)) return { ok: false, message: 'Lead is not ready to send an approved quote.' };

    var url = MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.SEND_QUOTE);
    var subject = 'Send approved quote to client - ' + leadId;
    try {
      MailApp.sendEmail({
        to: getIntakeEmail_(),
        name: 'MIDTS Backend',
        subject: subject,
        body: 'The quote is approved and ready for client delivery.\n\nLead ID: ' + leadId + '\nQuote Reference: ' + (leadResult.lead['Quote Reference'] || '') + '\n\nSend quote to client: ' + url,
        htmlBody: '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px"><p>The quote is approved and ready for client delivery.</p><p><strong>Lead ID:</strong> ' + escapeHtml_(leadId) + '<br><strong>Quote Reference:</strong> ' + escapeHtml_(leadResult.lead['Quote Reference'] || '') + '</p><p><a href="' + escapeHtml_(url) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">Send quote to client</a></p></div>'
      });
      MidtsSheetService.appendEmailLog([new Date(), leadId, leadResult.lead['Submission ID'] || '', getIntakeEmail_(), '', subject, 'sent', 'Quote send approval email sent']);
      return { ok: true, status: 'sent' };
    } catch (error) {
      var message = errorMessage_(error);
      MidtsSheetService.appendEmailLog([new Date(), leadId, leadResult.lead['Submission ID'] || '', getIntakeEmail_(), '', subject, 'failed', message]);
      return { ok: false, message: message };
    }
  }

  function sendQuoteAccessEmail(leadId) {
    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok: false, message: 'Lead not found: ' + leadId };
    var lead = leadResult.lead;
    if (String(lead['Quote Status'] || '') !== 'Sent' || !String(lead['Quote Document Link'] || '').trim()) {
      return { ok: false, message: 'A sent quote with a document link is required.' };
    }

    var subject = 'MIDTS quote access - ' + (lead['Quote Reference'] || '');
    var quoteUrl = lead['Quote Document Link'];
    try {
      MailApp.sendEmail({
        to: lead['Email'],
        bcc: getIntakeEmail_(),
        replyTo: getIntakeEmail_(),
        name: 'MIDTS',
        subject: subject,
        body: 'Your MIDTS quote is available.\n\nView quote: ' + quoteUrl,
        htmlBody: quoteAccessHtml_(quoteUrl)
      });
      MidtsSheetService.appendEmailLog([new Date(), leadId, lead['Submission ID'] || '', lead['Email'], getIntakeEmail_(), subject, 'sent', 'Quote access email resent without changing client response state']);
      return { ok: true, status: 'sent' };
    } catch (error) {
      return { ok: false, message: errorMessage_(error) };
    }
  }

  function sendQuoteToClient(leadId, sender) {
    var lock = LockService.getScriptLock();
    var locked = false;
    try {
      locked = lock.tryLock(10000);
      if (!locked) return { ok: false, message: 'Quote delivery is busy. Try again in a moment.' };

      var leadResult = MidtsSheetService.findLeadById(leadId);
      if (!leadResult) return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
      var lead = leadResult.lead;
      if (!isClientDeliveryEnabled_()) return { ok: false, code: 'CLIENT_QUOTE_DOCUMENT_NOT_READY', message: 'Client delivery is disabled until a client-specific quote document is available.' };
      if (!isReadyToSend_(lead)) return { ok: false, code: 'QUOTE_NOT_READY_TO_SEND', message: 'Quote must be approved before it can be sent.' };
      if (!String(lead['Email'] || '').trim()) return { ok: false, code: 'CLIENT_EMAIL_MISSING', message: 'Client email is required before sending the quote.' };

      var now = new Date();
      var responseId = 'QR-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
      var rawToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
      var response = {
        'Response ID': responseId,
        'Lead ID': leadId,
        'Quote Reference': lead['Quote Reference'] || '',
        'Created At': now,
        'Sent At': '',
        'Client Email': lead['Email'],
        'Response Token Hash': hashToken_(rawToken),
        'Response Status': 'Pending Send',
        'Responded At': '',
        'Client Outcome': '',
        'Client Notes': '',
        'Last Updated At': now
      };
      appendResponse_(response);

      var emailResult = emailClientQuote_(response, lead, rawToken);
      var savedResponse = findResponseById_(responseId);
      if (!emailResult.ok) {
        updateResponse_(savedResponse, { 'Response Status': 'Send Failed', 'Last Updated At': new Date() });
        return { ok: false, code: 'QUOTE_EMAIL_FAILED', message: emailResult.message };
      }

      updateResponse_(savedResponse, { 'Response Status': 'Sent', 'Sent At': new Date(), 'Last Updated At': new Date() });
      MidtsSheetService.updateLeadById(leadId, {
        'Lifecycle Status': 'Quote Sent',
        'Next Action': 'Await client decision',
        'Next Action Due': new Date(),
        'Quote Status': 'Sent',
        'Quote Sent At': new Date(),
        'Reviewer': sender || 'Email Approval',
        'Last Updated At': new Date()
      });
      MidtsLogger.logWebhookAttempt({
        requestId: responseId,
        outcome: 'quote_sent_to_client',
        message: 'Approved quote sent to client',
        payload: { leadId: leadId, quoteReference: lead['Quote Reference'] || '', clientEmail: lead['Email'] },
        submissionId: lead['Submission ID'] || '',
        email: lead['Email'] || '',
        source: 'Quote Delivery Service'
      });
      return { ok: true, leadId: leadId, responseId: responseId, nextAction: 'Await client decision', lifecycleStatus: 'Quote Sent', quoteStatus: 'Sent' };
    } finally {
      if (locked) lock.releaseLock();
    }
  }

  function renderClientResponse(e) {
    var params = e && e.parameter || {};
    var response = validateResponse_(params.responseId, params.token, params.outcome);
    if (!response.ok) return htmlPage_('Quote response unavailable', '<p>' + escapeHtml_(response.message) + '</p>');

    var label = outcomeLabel_(params.outcome);
    return htmlPage_('Confirm quote response', [
      '<p class="meta">MIDTS QUOTE RESPONSE</p>',
      '<h1>' + escapeHtml_(label) + '</h1>',
      '<p class="lede">Please confirm your response for quote ' + escapeHtml_(response.record['Quote Reference'] || '') + '.</p>',
      '<form method="post" action="' + escapeHtml_(MidtsConfig.getWebAppUrl()) + '" target="_top">',
      hidden_('action', 'quoteResponse'),
      hidden_('responseId', params.responseId),
      hidden_('token', params.token),
      hidden_('outcome', params.outcome),
      '<label>Optional note<textarea name="notes"></textarea></label>',
      '<button type="submit">Confirm ' + escapeHtml_(label.toLowerCase()) + '</button>',
      '</form>'
    ].join(''));
  }

  function handleClientResponse(e) {
    var lock = LockService.getScriptLock();
    var locked = false;
    try {
      locked = lock.tryLock(10000);
      if (!locked) return htmlPage_('Quote response delayed', '<p>Please try again in a moment.</p>');

      var params = e && e.parameter || {};
      var response = validateResponse_(params.responseId, params.token, params.outcome);
      if (!response.ok) return htmlPage_('Quote response unavailable', '<p>' + escapeHtml_(response.message) + '</p>');

      var outcome = normalizeOutcome_(params.outcome);
      var leadUpdate = outcomeUpdates_(outcome);
      var now = new Date();
      updateResponse_(response.result, {
        'Response Status': 'Responded',
        'Responded At': now,
        'Client Outcome': outcomeLabel_(outcome),
        'Client Notes': String(params.notes || '').trim(),
        'Last Updated At': now
      });
      MidtsSheetService.updateLeadById(response.record['Lead ID'], Object.assign(leadUpdate, { 'Last Updated At': now }));
      sendClientOutcomeNotification_(response.record, outcome, String(params.notes || '').trim());
      MidtsLogger.logWebhookAttempt({
        requestId: 'QUOTE-RESPONSE-' + response.record['Response ID'],
        outcome: 'quote_client_' + outcome,
        message: 'Client quote response recorded: ' + outcomeLabel_(outcome),
        payload: { leadId: response.record['Lead ID'], responseId: response.record['Response ID'], notes: String(params.notes || '').trim() },
        submissionId: '',
        email: response.record['Client Email'] || '',
        source: 'Quote Delivery Service'
      });

      return htmlPage_('Quote response recorded', '<p>Thank you. MIDTS has recorded your response.</p>');
    } catch (error) {
      return htmlPage_('Quote response failed', '<p>' + escapeHtml_(errorMessage_(error)) + '</p>');
    } finally {
      if (locked) lock.releaseLock();
    }
  }

  function validateResponse_(responseId, rawToken, outcome) {
    if (!responseId || !rawToken || !outcome) return { ok: false, message: 'This quote response link is incomplete.' };
    var normalizedOutcome = normalizeOutcome_(outcome);
    if (!normalizedOutcome) return { ok: false, message: 'This quote response is not recognised.' };

    var result = findResponseById_(responseId);
    if (!result) return { ok: false, message: 'This quote response link is not recognised.' };
    if (hashToken_(rawToken) !== String(result.record['Response Token Hash'] || '')) return { ok: false, message: 'This quote response link is invalid.' };
    if (String(result.record['Response Status'] || '') !== 'Sent') return { ok: false, message: 'This quote response has already been recorded or is unavailable.' };
    return { ok: true, result: result, record: result.record };
  }

  function emailClientQuote_(response, lead, rawToken) {
    var quoteUrl = String(lead['Quote Document Link'] || '').trim();
    if (!quoteUrl) return { ok: false, message: 'Quote document link is missing.' };

    var acceptUrl = responseUrl_(response['Response ID'], rawToken, 'accept');
    var declineUrl = responseUrl_(response['Response ID'], rawToken, 'decline');
    var reviseUrl = responseUrl_(response['Response ID'], rawToken, 'request-changes');
    var subject = 'Your MIDTS quote - ' + (response['Quote Reference'] || '');
    try {
      MailApp.sendEmail({
        to: response['Client Email'],
        bcc: getIntakeEmail_(),
        replyTo: getIntakeEmail_(),
        name: 'MIDTS',
        subject: subject,
        body: [
          'Hello ' + (lead['Full Name'] || '') + ',',
          '',
          'Your MIDTS quote is ready.',
          'Quote reference: ' + (response['Quote Reference'] || ''),
          'View quote: ' + quoteUrl,
          '',
          'Accept quote: ' + acceptUrl,
          'Request changes: ' + reviseUrl,
          'Decline quote: ' + declineUrl,
          '',
          'MIDTS'
        ].join('\n'),
        htmlBody: [
          '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px">',
          '<p>Hello ' + escapeHtml_(lead['Full Name'] || '') + ',</p>',
          '<p>Your MIDTS quote is ready.</p>',
          '<p><strong>Quote reference:</strong> ' + escapeHtml_(response['Quote Reference'] || '') + '</p>',
          quoteAccessHtml_(quoteUrl),
          '<p><a href="' + escapeHtml_(acceptUrl) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">Accept quote</a> ',
          '<a href="' + escapeHtml_(reviseUrl) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">Request changes</a> ',
          '<a href="' + escapeHtml_(declineUrl) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">Decline quote</a></p>',
          '<p>MIDTS</p></div>'
        ].join('')
      });
      MidtsSheetService.appendEmailLog([new Date(), response['Lead ID'], '', response['Client Email'], getIntakeEmail_(), subject, 'sent', 'Approved quote sent to client']);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: errorMessage_(error) };
    }
  }

  function sendClientOutcomeNotification_(response, outcome, notes) {
    var subject = 'Client quote response - ' + (response['Quote Reference'] || response['Lead ID']);
    var body = [
      'A client response has been recorded.',
      '',
      'Lead ID: ' + (response['Lead ID'] || ''),
      'Quote Reference: ' + (response['Quote Reference'] || ''),
      'Outcome: ' + outcomeLabel_(outcome),
      notes ? 'Client note: ' + notes : ''
    ].filter(function (line) { return line !== ''; }).join('\n');

    try {
      MailApp.sendEmail({
        to: getIntakeEmail_(),
        name: 'MIDTS Backend',
        subject: subject,
        body: body
      });
      MidtsSheetService.appendEmailLog([new Date(), response['Lead ID'] || '', '', getIntakeEmail_(), '', subject, 'sent', 'Client quote response notification sent']);
    } catch (error) {
      console.log('Client response notification failed: ' + errorMessage_(error));
    }
  }

  function quoteAccessHtml_(quoteUrl) {
    return '<p><a href="' + escapeHtml_(quoteUrl) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">View quote</a></p>' +
      '<p style="font-size:12px;word-break:break-all">If the button does not open, use this direct link:<br><a href="' + escapeHtml_(quoteUrl) + '">' + escapeHtml_(quoteUrl) + '</a></p>';
  }

  function responseUrl_(responseId, token, outcome) {
    return MidtsConfig.getWebAppUrl() + '?action=quoteResponse&responseId=' + encodeURIComponent(responseId) + '&token=' + encodeURIComponent(token) + '&outcome=' + encodeURIComponent(outcome);
  }

  function outcomeUpdates_(outcome) {
    if (outcome === 'accept') {
      return { 'Lifecycle Status': 'Quote Accepted', 'Next Action': 'Open delivery', 'Next Action Due': new Date(), 'Quote Status': 'Accepted', 'Final Outcome': 'Quote Accepted' };
    }
    if (outcome === 'request-changes') {
      return { 'Lifecycle Status': 'Quote Revision', 'Next Action': 'Review client feedback', 'Next Action Due': new Date(), 'Quote Status': 'Revision Requested', 'Final Outcome': '' };
    }
    return { 'Lifecycle Status': 'Quote Declined', 'Next Action': 'Review client feedback', 'Next Action Due': new Date(), 'Quote Status': 'Declined', 'Final Outcome': 'Quote Declined', 'Close Reason': 'Client declined quote', 'Closed At': new Date() };
  }

  function isClientDeliveryEnabled_() {
    return String(MidtsConfig.getScriptProperty('QUOTE_CLIENT_DELIVERY_ENABLED') || '').toLowerCase() === 'true';
  }

  function isReadyToSend_(lead) {
    return String(lead['Lifecycle Status'] || '') === 'Quote Approved' &&
      String(lead['Quote Status'] || '') === 'Approved to Send' &&
      String(lead['Quote Document Link'] || '').trim() !== '';
  }

  function normalizeOutcome_(value) {
    var outcome = String(value || '').trim().toLowerCase();
    return outcome === 'accept' || outcome === 'decline' || outcome === 'request-changes' ? outcome : '';
  }

  function outcomeLabel_(outcome) {
    return { accept: 'Accept quote', decline: 'Decline quote', 'request-changes': 'Request changes' }[normalizeOutcome_(outcome)] || 'Quote response';
  }

  function getSheet_() {
    var id = MidtsConfig.getSpreadsheetId();
    var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('No spreadsheet is available for quote responses.');
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    var headers = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    var missing = HEADERS.filter(function (header) { return headers.indexOf(header) === -1; });
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    else if (missing.length) sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  function ensureQuoteResponseSheet() {
    getSheet_();
    return SHEET_NAME;
  }

  function appendResponse_(record) {
    getSheet_().appendRow(HEADERS.map(function (header) { return record[header] === undefined ? '' : record[header]; }));
  }

  function findResponseById_(responseId) {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return null;
    var headers = values[0].reduce(function (map, header, index) { map[String(header || '').trim()] = index + 1; return map; }, {});
    for (var i = 1; i < values.length; i += 1) {
      if (String(values[i][headers['Response ID'] - 1]) === String(responseId)) {
        var record = {};
        Object.keys(headers).forEach(function (header) { record[header] = values[i][headers[header] - 1]; });
        return { sheet: sheet, rowNumber: i + 1, headers: headers, record: record };
      }
    }
    return null;
  }

  function updateResponse_(result, updates) {
    if (!result) throw new Error('Quote response not found.');
    Object.keys(updates).forEach(function (header) {
      result.sheet.getRange(result.rowNumber, result.headers[header]).setValue(updates[header]);
    });
  }

  function hashToken_(value) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8).map(function (byte) {
      var safe = byte < 0 ? byte + 256 : byte;
      return ('0' + safe.toString(16)).slice(-2);
    }).join('');
  }

  function getIntakeEmail_() {
    return MidtsConfig.getScriptProperty('INTAKE_EMAIL') || 'midts.systems@gmail.com';
  }

  function hidden_(name, value) {
    return '<input type="hidden" name="' + escapeHtml_(name) + '" value="' + escapeHtml_(value) + '">';
  }

  function htmlPage_(title, body) {
    return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml_(title) + '</title><style>body{margin:0;font-family:Arial,sans-serif;color:#111;line-height:1.5}.wrap{max-width:640px;margin:0 auto;padding:48px 24px}h1{font-size:32px;line-height:1.1}.meta{font-size:12px;letter-spacing:.08em}.lede{font-size:17px}label{display:block;font-size:14px;font-weight:bold;margin:24px 0 16px}textarea{box-sizing:border-box;display:block;width:100%;min-height:110px;margin-top:6px;padding:10px;border:1px solid #111;font:16px Arial,sans-serif}button{border:1px solid #111;background:#111;color:#fff;padding:12px 16px;font:14px Arial,sans-serif}@media(max-width:560px){.wrap{padding:32px 18px}}</style></head><body><main class="wrap">' + body + '</main></body></html>');
  }

  function escapeHtml_(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function errorMessage_(error) {
    return String(error && error.message ? error.message : error);
  }

  return {
    ensureQuoteResponseSheet: ensureQuoteResponseSheet,
    sendQuoteSendEmail: sendQuoteSendEmail,
    sendQuoteAccessEmail: sendQuoteAccessEmail,
    sendQuoteToClient: sendQuoteToClient,
    renderClientResponse: renderClientResponse,
    handleClientResponse: handleClientResponse
  };
})();