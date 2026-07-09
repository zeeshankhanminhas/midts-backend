var MidtsWebhookRouter = (function () {
  function handlePost(e) {
    var requestId = createRequestId();
    var payload = {};

    try {
      payload = parsePostEvent(e);

      var tokenResult = MidtsTokenService.validate(payload);
      if (!tokenResult.ok) {
        MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'rejected', message: tokenResult.code, payload: scrubPayload(payload), submissionId: payload.lead_id || payload.submissionId || payload.leadId || '', email: payload.work_email || payload.email || '', source: payload.source || 'Website' });
        return MidtsResponseService.failure(tokenResult.code, tokenResult.message, { requestId: requestId });
      }

      if (isWorkspaceReadPayload_(payload)) return handleWorkspaceRead_(payload, requestId);
      if (isMarginReviewPayload_(payload)) return handleMarginReview_(payload, requestId);
      if (isVendorSafePackagePayload_(payload)) return handleVendorSafePackage_(payload, requestId);
      if (isVendorRequestSetupPayload_(payload)) return handleVendorRequestSetup_(payload, requestId);
      if (isTechnicalReviewPayload_(payload)) return handleTechnicalReview_(payload, requestId);
      if (isQualificationDecisionPayload_(payload)) return handleQualificationDecision_(payload, requestId);
      if (isStep2Payload_(payload)) return handleStep2_(payload, requestId);

      return handleStep1_(payload, requestId);
    } catch (error) {
      try { MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'error', message: String(error && error.message ? error.message : error), payload: scrubPayload(payload) }); } catch (logError) { console.error(logError); }
      return MidtsResponseService.failure('SERVER_ERROR', 'The enquiry could not be processed.', { requestId: requestId, error: String(error && error.message ? error.message : error) });
    }
  }

  function handleStep1_(payload, requestId) {
    var leadResult = MidtsLeadService.createLead(payload);
    if (!leadResult.ok) {
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'failed', message: leadResult.code, payload: scrubPayload(payload), submissionId: leadResult.lead && leadResult.lead.submissionId, email: leadResult.lead && leadResult.lead.email, source: leadResult.lead && leadResult.lead.source });
      return MidtsResponseService.failure(leadResult.code, leadResult.message, { requestId: requestId });
    }

    if (leadResult.duplicate) {
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'duplicate', message: 'Duplicate Step 1 submission ignored; existing lead returned', payload: scrubPayload(payload), submissionId: leadResult.submissionId, email: leadResult.lead.email, source: leadResult.lead.source });
      return MidtsResponseService.success({ requestId: requestId, leadId: leadResult.leadId, submissionId: leadResult.submissionId, duplicate: true, lifecycleStatus: leadResult.lifecycleStatus, reviewStatus: leadResult.reviewStatus, nextAction: leadResult.nextAction, emailStatus: 'skipped', internalNotificationStatus: 'skipped', message: 'Duplicate Step 1 submission ignored; existing lead returned.' });
    }

    var emailResult = MidtsEmailService.sendLeadAcknowledgement(leadResult);
    MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'success', message: emailResult.ok ? 'Step 1 lead created; awaiting Step 2' : 'Step 1 lead created; acknowledgement failed', payload: scrubPayload(payload), submissionId: leadResult.submissionId, email: leadResult.lead.email, source: leadResult.lead.source });
    return MidtsResponseService.success({ requestId: requestId, leadId: leadResult.leadId, submissionId: leadResult.submissionId, duplicate: false, lifecycleStatus: leadResult.lifecycleStatus, reviewStatus: leadResult.reviewStatus, nextAction: leadResult.nextAction, emailStatus: emailResult.status, internalNotificationStatus: 'not_sent_until_step_2', message: 'Step 1 received. Client acknowledgement sent and Step 2 is required before review.' });
  }

  function handleStep2_(payload, requestId) {
    var step2Result = MidtsTechnicalIntakeService.completeStep2(payload);
    if (!step2Result.ok) {
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'step2_failed', message: step2Result.code, payload: scrubPayload(payload), submissionId: payload.submission_id || payload.submissionId || '', email: payload.work_email || payload.email || '', source: payload.source || 'Website Step 2' });
      return MidtsResponseService.failure(step2Result.code, step2Result.message, { requestId: requestId });
    }
    var internalNotificationResult = MidtsEmailService.sendInternalReviewNotification(step2Result);
    MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'step2_success', message: internalNotificationResult.ok ? 'Step 2 completed; internal review notified' : 'Step 2 completed; internal review notification failed', payload: scrubPayload(payload), submissionId: step2Result.submissionId, email: step2Result.lead.email, source: 'Website Step 2' });
    return MidtsResponseService.success({ requestId: requestId, leadId: step2Result.leadId, submissionId: step2Result.submissionId, technicalIntakeId: step2Result.technicalIntakeId, lifecycleStatus: step2Result.lifecycleStatus, reviewStatus: step2Result.reviewStatus, nextAction: step2Result.nextAction, internalNotificationStatus: internalNotificationResult.status, vendorSafePackageRequired: step2Result.vendorSafePackageRequired, uploadedFileLinks: step2Result.uploadedFileLinks || [], uploadFolderUrl: step2Result.uploadFolderUrl || '', message: 'Step 2 completed. Lead is ready for human review.' });
  }

  function handleWorkspaceRead_(payload, requestId) {
    var action = normalizeCompact_(payload.action || '');
    if (action === 'listpendingtechnicalreviews') return workspaceReadSuccess_(requestId, payload, MidtsWorkspaceReadService.listPendingTechnicalReviews(), 'Pending technical reviews listed');
    if (action === 'listpendingqualificationdecisions') return workspaceReadSuccess_(requestId, payload, MidtsWorkspaceReadService.listPendingQualificationDecisions(), 'Pending qualification decisions listed');
    if (action === 'listpendingvendorsafepackages') return workspaceReadSuccess_(requestId, payload, MidtsWorkspaceReadService.listPendingVendorSafePackages(), 'Pending vendor-safe packages listed');
    if (action === 'listpendingvendorrequestsetups') return workspaceReadSuccess_(requestId, payload, MidtsWorkspaceReadService.listPendingVendorRequestSetups(), 'Pending vendor request setups listed');
    if (action === 'listpendingmarginreviews') return workspaceReadSuccess_(requestId, payload, MidtsMarginReviewService.listPendingMarginReviews(), 'Pending margin reviews listed');
    if (action === 'listpendingquotebuilders') return workspaceReadSuccess_(requestId, payload, MidtsWorkspaceReadService.listPendingQuoteBuilders(), 'Pending quote builder records listed');
    MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'workspace_read_failed', message: 'UNSUPPORTED_WORKSPACE_READ_ACTION: ' + String(payload.action || ''), payload: scrubPayload(payload), source: payload.source || 'WorkspaceRead' });
    return MidtsResponseService.failure('UNSUPPORTED_WORKSPACE_READ_ACTION', 'Workspace read action is not supported: ' + String(payload.action || ''), { requestId: requestId });
  }

  function workspaceReadSuccess_(requestId, payload, result, message) {
    logWorkspaceRead_(requestId, payload, message);
    return MidtsResponseService.success(Object.assign({ requestId: requestId }, result));
  }

  function handleTechnicalReview_(payload, requestId) {
    var reviewResult = MidtsTechnicalReviewService.recordReview(payload);
    if (!reviewResult.ok) {
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'technical_review_failed', message: reviewResult.code, payload: scrubPayload(payload), submissionId: payload.leadId || payload.lead_id || '', source: payload.source || 'WorkspaceTechnicalReview' });
      return MidtsResponseService.failure(reviewResult.code, reviewResult.message, { requestId: requestId });
    }
    MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'technical_review_success', message: 'Technical review recorded', payload: scrubPayload(payload), submissionId: reviewResult.leadId, source: payload.source || 'WorkspaceTechnicalReview' });
    return MidtsResponseService.success({ requestId: requestId, reviewId: reviewResult.reviewId, leadId: reviewResult.leadId, technicalIntakeId: reviewResult.technicalIntakeId, recommendation: reviewResult.recommendation, reviewStatus: 'Technical Review Complete', nextAction: reviewResult.nextAction, message: 'Technical review recorded. Qualification decision can now be recorded.' });
  }

  function handleQualificationDecision_(payload, requestId) {
    var decisionResult = MidtsDecisionService.applyDecision(payload.leadId || payload.lead_id, payload.decision, payload.reviewer || payload.actor || 'MIDTS Reviewer');
    if (!decisionResult.ok) {
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: decisionResult.blocked ? 'qualification_decision_blocked' : 'qualification_decision_failed', message: decisionResult.message || 'Qualification decision could not be recorded.', payload: scrubPayload(payload), submissionId: payload.leadId || payload.lead_id || '', source: payload.source || 'WorkspaceQualificationDecision' });
      return MidtsResponseService.failure(decisionResult.blocked ? 'QUALIFICATION_DECISION_BLOCKED' : 'QUALIFICATION_DECISION_FAILED', decisionResult.message || 'Qualification decision could not be recorded.', { requestId: requestId });
    }
    MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: decisionResult.alreadyProcessed ? 'qualification_decision_duplicate' : 'qualification_decision_success', message: decisionResult.alreadyProcessed ? 'Qualification decision already recorded' : 'Qualification decision recorded: ' + decisionResult.decisionLabel, payload: scrubPayload(payload), submissionId: decisionResult.leadId, source: payload.source || 'WorkspaceQualificationDecision' });
    return MidtsResponseService.success({ requestId: requestId, leadId: decisionResult.leadId, decision: decisionResult.decision, decisionLabel: decisionResult.decisionLabel, nextAction: decisionResult.nextAction, outcomeEmailStatus: decisionResult.outcomeEmailStatus, alreadyProcessed: Boolean(decisionResult.alreadyProcessed), message: decisionResult.alreadyProcessed ? decisionResult.message : 'Qualification decision recorded. Outcome routing has been applied.' });
  }

  function handleVendorSafePackage_(payload, requestId) {
    var packageResult = MidtsVendorPricingService.markVendorSafePackageReady(payload.leadId || payload.lead_id, payload.reviewer || payload.actor || 'MIDTS Reviewer');
    if (!packageResult.ok) {
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'vendor_safe_package_failed', message: packageResult.message || packageResult.code || 'Vendor-safe package could not be prepared.', payload: scrubPayload(payload), submissionId: payload.leadId || payload.lead_id || '', source: payload.source || 'WorkspaceVendorSafePackage' });
      return MidtsResponseService.failure(packageResult.code || 'VENDOR_SAFE_PACKAGE_FAILED', packageResult.message || 'Vendor-safe package could not be prepared.', { requestId: requestId });
    }
    MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'vendor_safe_package_success', message: 'Vendor-safe package prepared', payload: scrubPayload(payload), submissionId: packageResult.leadId, source: payload.source || 'WorkspaceVendorSafePackage' });
    return MidtsResponseService.success(Object.assign({ requestId: requestId, message: 'Vendor-safe package prepared. Lead moved to Vendor Pricing.' }, packageResult));
  }

  function handleVendorRequestSetup_(payload, requestId) {
    var requestResult = MidtsVendorRequestService.createAndSendRequest({ leadId: payload.leadId || payload.lead_id, vendorName: payload.vendorName || payload.vendor_name, vendorEmail: payload.vendorEmail || payload.vendor_email, packageLink: payload.packageLink || payload.package_link, vendorSafeFilesConfirmed: payload.vendorSafeFilesConfirmed || payload.vendor_safe_files_confirmed });
    if (!requestResult.ok) {
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'vendor_request_setup_failed', message: requestResult.message || 'Vendor request could not be sent.', payload: scrubPayload(payload), submissionId: payload.leadId || payload.lead_id || '', source: payload.source || 'WorkspaceVendorRequestSetup' });
      return MidtsResponseService.failure('VENDOR_REQUEST_SETUP_FAILED', requestResult.message || 'Vendor request could not be sent.', { requestId: requestId });
    }
    MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'vendor_request_setup_success', message: 'Vendor pricing request sent from Workspace', payload: scrubPayload(payload), submissionId: requestResult.leadId, email: requestResult.vendorEmail, source: payload.source || 'WorkspaceVendorRequestSetup' });
    return MidtsResponseService.success(Object.assign({ requestId: requestId, message: 'Vendor pricing request sent.' }, requestResult));
  }

  function handleMarginReview_(payload, requestId) {
    var action = normalizeCompact_(payload.action || 'approveMargin');
    var leadId = payload.leadId || payload.lead_id;
    var reviewer = payload.reviewer || payload.actor || 'MIDTS Margin Reviewer';
    var notes = payload.internalNotes || payload.notes || '';
    var marginResult;

    if (action === 'updatemarginreview') {
      marginResult = MidtsMarginReviewService.updateMarginReview(payload);
    } else if (action === 'rejectmargin') {
      marginResult = MidtsMarginReviewService.rejectMargin(leadId, reviewer, notes);
    } else if (action === 'returnmargintovendor') {
      marginResult = MidtsMarginReviewService.returnMarginToVendor(leadId, reviewer, notes);
    } else {
      marginResult = MidtsMarginReviewService.approveMargin(leadId, reviewer);
    }

    if (!marginResult.ok) {
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'margin_review_failed', message: marginResult.message || marginResult.code || 'Margin review action could not be completed.', payload: scrubPayload(payload), submissionId: leadId || '', source: payload.source || 'WorkspaceMarginReview' });
      return MidtsResponseService.failure(marginResult.code || 'MARGIN_REVIEW_FAILED', marginResult.message || 'Margin review action could not be completed.', { requestId: requestId });
    }
    MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: action === 'approvemargin' ? 'margin_review_success' : 'margin_review_outcome_success', message: action === 'approvemargin' ? 'Margin approved from Workspace' : 'Margin review outcome recorded from Workspace', payload: scrubPayload(payload), submissionId: marginResult.leadId, source: payload.source || 'WorkspaceMarginReview' });
    return MidtsResponseService.success(Object.assign({ requestId: requestId, message: action === 'approvemargin' ? 'Margin approved. Lead moved to Quote Builder.' : action === 'updatemarginreview' ? 'Margin adjustment saved.' : 'Margin review outcome recorded.' }, marginResult));
  }

  function logWorkspaceRead_(requestId, payload, message) { MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'workspace_read_success', message: message, payload: scrubPayload(payload), source: payload.source || 'WorkspaceRead' }); }

  function parsePostEvent(e) {
    if (!e) return {};
    if (e.postData && e.postData.contents) {
      var contents = e.postData.contents;
      var type = String(e.postData.type || '').toLowerCase();
      if (type.indexOf('application/json') !== -1 || looksLikeJson(contents)) return JSON.parse(contents);
      return parseUrlEncoded(contents);
    }
    return Object.assign({}, e.parameter || {});
  }

  function isWorkspaceReadPayload_(payload) {
    var stage = normalizeCompact_(payload.formStage || payload.form_stage || payload.stage || '');
    var action = normalizeCompact_(payload.action || '');
    return stage === 'workspaceread' || action === 'listpendingtechnicalreviews' || action === 'listpendingqualificationdecisions' || action === 'listpendingvendorsafepackages' || action === 'listpendingvendorrequestsetups' || action === 'listpendingmarginreviews' || action === 'listpendingquotebuilders';
  }
  function isStep2Payload_(payload) { var stage = normalizeStage_(payload.formStage || payload.form_stage || payload.stage || ''); return stage === 'step2' || stage === 'technicalintake'; }
  function isTechnicalReviewPayload_(payload) { var stage = normalizeStage_(payload.formStage || payload.form_stage || payload.stage || ''); var action = normalizeCompact_(payload.action || ''); return stage === 'technicalreview' || action === 'recordtechnicalreview'; }
  function isQualificationDecisionPayload_(payload) { var stage = normalizeStage_(payload.formStage || payload.form_stage || payload.stage || ''); var action = normalizeCompact_(payload.action || ''); return stage === 'qualificationdecision' || action === 'recordqualificationdecision'; }
  function isVendorSafePackagePayload_(payload) { var stage = normalizeStage_(payload.formStage || payload.form_stage || payload.stage || ''); var action = normalizeCompact_(payload.action || ''); return stage === 'vendorsafepackage' || action === 'recordvendorsafepackage'; }
  function isVendorRequestSetupPayload_(payload) { var stage = normalizeStage_(payload.formStage || payload.form_stage || payload.stage || ''); var action = normalizeCompact_(payload.action || ''); return stage === 'vendorrequestsetup' || action === 'setupvendorrequest'; }
  function isMarginReviewPayload_(payload) { var stage = normalizeStage_(payload.formStage || payload.form_stage || payload.stage || ''); var action = normalizeCompact_(payload.action || ''); return stage === 'marginreview' || action === 'approvemargin' || action === 'updatemarginreview' || action === 'rejectmargin' || action === 'returnmargintovendor'; }
  function normalizeStage_(value) { return normalizeCompact_(value); }
  function normalizeCompact_(value) { return String(value || '').trim().toLowerCase().replace(/_/g, '').replace(/-/g, '').replace(/\s+/g, ''); }
  function looksLikeJson(contents) { var trimmed = String(contents || '').trim(); return trimmed.charAt(0) === '{' || trimmed.charAt(0) === '['; }
  function parseUrlEncoded(contents) { var result = {}; String(contents || '').split('&').forEach(function (pair) { if (!pair) return; var parts = pair.split('='); var key = decodeURIComponent((parts[0] || '').replace(/\+/g, ' ')); var value = decodeURIComponent((parts.slice(1).join('=') || '').replace(/\+/g, ' ')); result[key] = value; }); return result; }
  function scrubPayload(payload) { var clone = Object.assign({}, payload || {}); ['webhookToken', 'webhook_token', 'formToken', 'token', 'WEBSITE_WEBHOOK_TOKEN'].forEach(function (key) { if (clone[key]) clone[key] = '[redacted]'; }); if (Array.isArray(clone.uploadedFiles)) clone.uploadedFiles = clone.uploadedFiles.map(function (file) { return { name: file && file.name || '', type: file && file.type || '', sizeBytes: file && file.sizeBytes || '', contentBase64: '[redacted]' }; }); return clone; }
  function createRequestId() { return 'REQ-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmssSSS'); }

  return { handlePost: handlePost, parsePostEvent: parsePostEvent, scrubPayload: scrubPayload };
})();