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

      var emailResult = MidtsEmailService.sendLeadAcknowledgement(leadResult);
      var internalNotificationResult = MidtsEmailService.sendInternalReviewNotification(leadResult);
      var webhookMessage = buildSuccessMessage_(emailResult, internalNotificationResult);

      MidtsLogger.logWebhookAttempt({
        requestId: requestId,
        outcome: 'success',
        message: webhookMessage,
        payload: scrubPayload(payload),
        submissionId: leadResult.submissionId,
        email: leadResult.lead.email,
        source: leadResult.lead.source
      });

      return MidtsResponseService.success({
        requestId: requestId,
        leadId: leadResult.leadId,
        submissionId: leadResult.submissionId,
        lifecycleStatus: leadResult.lifecycleStatus,
        reviewStatus: leadResult.reviewStatus,
        nextAction: leadResult.nextAction,
        emailStatus: emailResult.status,
        internalNotificationStatus: internalNotificationResult.status,
        message: webhookMessage
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

  function buildSuccessMessage_(emailResult, internalNotificationResult) {
    if (emailResult.ok && internalNotificationResult.ok) {
      return 'Lead created, acknowledgement sent, internal review notified';
    }
    if (!emailResult.ok && !internalNotificationResult.ok) {
      return 'Lead created; acknowledgement and internal notification failed';
    }
    if (!emailResult.ok) {
      return 'Lead created; acknowledgement email failed; internal review notified';
    }
    return 'Lead created and acknowledgement sent; internal notification failed';
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
