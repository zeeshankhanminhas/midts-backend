var MidtsWebhookRouter = (function () {
  function handlePost(e) {
    var requestId = createRequestId();
    var payload = {};

    try {
      payload = parsePostEvent(e);

      var tokenResult = MidtsTokenService.validate(payload);
      if (!tokenResult.ok) {
        MidtsLogger.logWebhookAttempt({
          requestId: requestId,
          outcome: 'rejected',
          message: tokenResult.code,
          payload: scrubPayload(payload),
          submissionId: payload.lead_id || payload.submissionId || '',
          email: payload.work_email || payload.email || '',
          source: payload.source || 'Website'
        });
        return MidtsResponseService.failure(tokenResult.code, tokenResult.message, { requestId: requestId });
      }

      var leadResult = MidtsLeadService.createLead(payload);
      if (!leadResult.ok) {
        MidtsLogger.logWebhookAttempt({
          requestId: requestId,
          outcome: 'failed',
          message: leadResult.code,
          payload: scrubPayload(payload),
          submissionId: leadResult.lead && leadResult.lead.submissionId,
          email: leadResult.lead && leadResult.lead.email,
          source: leadResult.lead && leadResult.lead.source
        });
        return MidtsResponseService.failure(leadResult.code, leadResult.message, { requestId: requestId });
      }

      MidtsLogger.logWebhookAttempt({
        requestId: requestId,
        outcome: 'success',
        message: 'Lead created',
        payload: scrubPayload(payload),
        submissionId: leadResult.submissionId,
        email: leadResult.lead.email,
        source: leadResult.lead.source
      });

      return MidtsResponseService.success({
        requestId: requestId,
        leadId: leadResult.leadId,
        submissionId: leadResult.submissionId,
        message: 'Lead created successfully.'
      });
    } catch (error) {
      try {
        MidtsLogger.logWebhookAttempt({
          requestId: requestId,
          outcome: 'error',
          message: String(error && error.message ? error.message : error),
          payload: scrubPayload(payload)
        });
      } catch (logError) {
        console.error(logError);
      }

      return MidtsResponseService.failure('SERVER_ERROR', 'The enquiry could not be processed.', {
        requestId: requestId,
        error: String(error && error.message ? error.message : error)
      });
    }
  }

  function parsePostEvent(e) {
    if (!e) return {};

    if (e.postData && e.postData.contents) {
      var contents = e.postData.contents;
      var type = String(e.postData.type || '').toLowerCase();

      if (type.indexOf('application/json') !== -1 || looksLikeJson(contents)) {
        return JSON.parse(contents);
      }

      return parseUrlEncoded(contents);
    }

    return Object.assign({}, e.parameter || {});
  }

  function looksLikeJson(contents) {
    var trimmed = String(contents || '').trim();
    return trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[';
  }

  function parseUrlEncoded(contents) {
    var result = {};
    String(contents || '').split('&').forEach(function (pair) {
      if (!pair) return;
      var parts = pair.split('=');
      var key = decodeURIComponent((parts[0] || '').replace(/\+/g, ' '));
      var value = decodeURIComponent((parts.slice(1).join('=') || '').replace(/\+/g, ' '));
      result[key] = value;
    });
    return result;
  }

  function scrubPayload(payload) {
    var clone = Object.assign({}, payload || {});
    ['webhookToken', 'webhook_token', 'formToken', 'token', 'WEBSITE_WEBHOOK_TOKEN'].forEach(function (key) {
      if (clone[key]) clone[key] = '[redacted]';
    });
    return clone;
  }

  function createRequestId() {
    return 'REQ-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmssSSS');
  }

  return {
    handlePost: handlePost,
    parsePostEvent: parsePostEvent,
    scrubPayload: scrubPayload
  };
})();
