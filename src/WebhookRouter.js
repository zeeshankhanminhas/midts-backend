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

      if (isStep2Payload_(payload)) {
        return handleStep2_(payload, requestId);
      }

      return handleStep1_(payload, requestId);
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

  function handleStep1_(payload, requestId) {
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

    if (leadResult.duplicate) {
      MidtsLogger.logWebhookAttempt({
        requestId: requestId,
        outcome: 'duplicate',
        message: 'Duplicate Step 1 submission ignored; existing lead returned',
        payload: scrubPayload(payload),
        submissionId: leadResult.submissionId,
        email: leadResult.lead.email,
        source: leadResult.lead.source
      });

      return MidtsResponseService.success({
        requestId: requestId,
        leadId: leadResult.leadId,
        submissionId: leadResult.submissionId,
        duplicate: true,
        lifecycleStatus: leadResult.lifecycleStatus,
        reviewStatus: leadResult.reviewStatus,
        nextAction: leadResult.nextAction,
        emailStatus: 'skipped',
        internalNotificationStatus: 'skipped',
        message: 'Duplicate Step 1 submission ignored; existing lead returned.'
      });
    }

    var emailResult = MidtsEmailService.sendLeadAcknowledgement(leadResult);

    MidtsLogger.logWebhookAttempt({
      requestId: requestId,
      outcome: 'success',
      message: emailResult.ok ? 'Step 1 lead created; awaiting Step 2' : 'Step 1 lead created; acknowledgement failed',
      payload: scrubPayload(payload),
      submissionId: leadResult.submissionId,
      email: leadResult.lead.email,
      source: leadResult.lead.source
    });

    return MidtsResponseService.success({
      requestId: requestId,
      leadId: leadResult.leadId,
      submissionId: leadResult.submissionId,
      duplicate: false,
      lifecycleStatus: leadResult.lifecycleStatus,
      reviewStatus: leadResult.reviewStatus,
      nextAction: leadResult.nextAction,
      emailStatus: emailResult.status,
      internalNotificationStatus: 'not_sent_until_step_2',
      message: 'Step 1 received. Client acknowledgement sent and Step 2 is required before review.'
    });
  }

  function handleStep2_(payload, requestId) {
    var step2Result = MidtsTechnicalIntakeService.completeStep2(payload);
    if (!step2Result.ok) {
      MidtsLogger.logWebhookAttempt({
        requestId: requestId,
        outcome: 'step2_failed',
        message: step2Result.code,
        payload: scrubPayload(payload),
        submissionId: payload.submission_id || payload.submissionId || '',
        email: payload.work_email || payload.email || '',
        source: payload.source || 'Website Step 2'
      });
      return MidtsResponseService.failure(step2Result.code, step2Result.message, { requestId: requestId });
    }

    var internalNotificationResult = MidtsEmailService.sendInternalReviewNotification(step2Result);

    MidtsLogger.logWebhookAttempt({
      requestId: requestId,
      outcome: 'step2_success',
      message: internalNotificationResult.ok ? 'Step 2 completed; internal review notified' : 'Step 2 completed; internal review notification failed',
      payload: scrubPayload(payload),
      submissionId: step2Result.submissionId,
      email: step2Result.lead.email,
      source: 'Website Step 2'
    });

    return MidtsResponseService.success({
      requestId: requestId,
      leadId: step2Result.leadId,
      submissionId: step2Result.submissionId,
      technicalIntakeId: step2Result.technicalIntakeId,
      lifecycleStatus: step2Result.lifecycleStatus,
      reviewStatus: step2Result.reviewStatus,
      nextAction: step2Result.nextAction,
      internalNotificationStatus: internalNotificationResult.status,
      vendorSafePackageRequired: step2Result.vendorSafePackageRequired,
      message: 'Step 2 completed. Lead is ready for human review.'
    });
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

  function isStep2Payload_(payload) {
    var stage = String(payload.formStage || payload.form_stage || payload.stage || '').toLowerCase();
    return stage === 'step2' || stage === 'step_2' || stage === 'technical-intake' || stage === 'technical_intake';
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
