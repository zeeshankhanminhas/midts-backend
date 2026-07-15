var MidtsWebhookRouter = (function () {
  function handlePost(e) {
    var requestId = createRequestId();
    var payload = {};
    try {
      payload = parsePostEvent(e);
      var tokenResult = MidtsTokenService.validate(payload);
      if (!tokenResult.ok) return MidtsResponseService.failure(tokenResult.code, tokenResult.message, { requestId: requestId });
      if (isWorkspaceReadPayload_(payload)) return handleWorkspaceRead_(payload, requestId);
      if (isInvoicePayload_(payload)) return handleInvoice_(payload, requestId);
      if (isProjectCreationPayload_(payload)) return handleProjectCreation_(payload, requestId);
      if (isQuoteAcceptancePayload_(payload)) return handleQuoteAcceptance_(payload, requestId);
      if (isQuoteSendPayload_(payload)) return handleQuoteSend_(payload, requestId);
      if (isQuoteDraftReviewPayload_(payload)) return handleQuoteDraftReview_(payload, requestId);
      if (isQuoteBuilderPayload_(payload)) return handleQuoteBuilder_(payload, requestId);
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
    var result = MidtsLeadService.createLead(payload);
    if (!result.ok) return MidtsResponseService.failure(result.code, result.message, { requestId:requestId });
    if (!result.duplicate) MidtsEmailService.sendLeadAcknowledgement(result);
    return MidtsResponseService.success({ requestId:requestId, leadId:result.leadId, submissionId:result.submissionId, duplicate:Boolean(result.duplicate), lifecycleStatus:result.lifecycleStatus, reviewStatus:result.reviewStatus, nextAction:result.nextAction, message:result.duplicate ? 'Duplicate Step 1 submission ignored; existing lead returned.' : 'Step 1 received. Client acknowledgement sent and Step 2 is required before review.' });
  }

  function handleStep2_(payload, requestId) {
    var result = MidtsTechnicalIntakeService.completeStep2(payload);
    if (!result.ok) return MidtsResponseService.failure(result.code, result.message, { requestId:requestId });
    var notice = MidtsEmailService.sendInternalReviewNotification(result);
    return MidtsResponseService.success({ requestId:requestId, leadId:result.leadId, submissionId:result.submissionId, technicalIntakeId:result.technicalIntakeId, lifecycleStatus:result.lifecycleStatus, reviewStatus:result.reviewStatus, nextAction:result.nextAction, internalNotificationStatus:notice.status, vendorSafePackageRequired:result.vendorSafePackageRequired, uploadedFileLinks:result.uploadedFileLinks || [], uploadFolderUrl:result.uploadFolderUrl || '', message:'Step 2 completed. Lead is ready for workspace review.' });
  }

  function handleWorkspaceRead_(payload, requestId) {
    var action = normalizeCompact_(payload.action || '');
    if (action === 'listpendingtechnicalreviews' || action === 'listpendingpartnerassessments') return readSuccess_(requestId, MidtsWorkspaceReadService.listPendingTechnicalReviews());
    if (action === 'listpendingqualificationdecisions') return readSuccess_(requestId, MidtsWorkspaceReadService.listPendingQualificationDecisions());
    if (action === 'getcommercialqualificationrecord' || action === 'getcommercialqualificationrecorddocument') return readSuccess_(requestId, MidtsCommercialQualificationRecordService.getCommercialQualificationRecord(payload));
    if (action === 'listpendingvendorsafepackages') return readSuccess_(requestId, MidtsWorkspaceReadService.listPendingVendorSafePackages());
    if (action === 'listpendingvendorrequestsetups') return readSuccess_(requestId, MidtsWorkspaceReadService.listPendingVendorRequestSetups());
    if (action === 'listpendingmarginreviews') return readSuccess_(requestId, MidtsMarginReviewService.listPendingMarginReviews());
    if (action === 'listpendingquotebuilders' || action === 'listpendingquotedrafts') return readSuccess_(requestId, MidtsQuoteBuilderService.listPendingQuoteBuilders());
    if (action === 'listpendingquotedraftreviews') return readSuccess_(requestId, MidtsQuoteDraftReviewService.listPendingQuoteDraftReviews());
    if (action === 'listpendingapprovedquotes' || action === 'listpendingquotesends') return readSuccess_(requestId, MidtsQuoteSendService.listPendingApprovedQuotes());
    if (action === 'listpendingquoteacceptances') return readSuccess_(requestId, MidtsQuoteAcceptanceService.listPendingQuoteAcceptances());
    if (action === 'listpendingprojectcreations') return readSuccess_(requestId, MidtsProjectService.listPendingProjectCreations());
    if (action === 'listpendinginvoices' || action === 'listpendinginvoicecreations') return readSuccess_(requestId, MidtsInvoiceService.listPendingInvoices());
    if (action === 'getquotedocument' || action === 'getquotebyid' || action === 'getquotebyleadid') return readSuccess_(requestId, MidtsDocumentService.getQuoteDocument(payload));
    return MidtsResponseService.failure('UNSUPPORTED_WORKSPACE_READ_ACTION', 'Workspace read action is not supported: ' + String(payload.action || ''), { requestId:requestId });
  }
  function readSuccess_(requestId, result) { return MidtsResponseService.success(Object.assign({ requestId:requestId }, result)); }

  function handleTechnicalReview_(payload, requestId) {
    var result = MidtsTechnicalReviewService.recordReview(payload);
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:'Partner Technical Assessment recorded. Qualification decision can now be recorded.' }, result)) : MidtsResponseService.failure(result.code, result.message, { requestId:requestId });
  }
  function handleQualificationDecision_(payload, requestId) {
    var result = MidtsDecisionService.applyDecision(payload.leadId || payload.lead_id, payload.decision, payload.reviewer || payload.actor || 'MIDTS Reviewer');
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:result.message || 'Qualification decision recorded.' }, result)) : MidtsResponseService.failure(result.blocked ? 'QUALIFICATION_DECISION_BLOCKED' : 'QUALIFICATION_DECISION_FAILED', result.message, { requestId:requestId });
  }
  function handleVendorSafePackage_(payload, requestId) {
    var result = MidtsVendorPricingService.markVendorSafePackageReady(payload.leadId || payload.lead_id, payload.reviewer || payload.actor || 'MIDTS Reviewer');
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:'Vendor-safe package prepared. Lead moved to Vendor Pricing.' }, result)) : MidtsResponseService.failure(result.code || 'VENDOR_SAFE_PACKAGE_FAILED', result.message, { requestId:requestId });
  }
  function handleVendorRequestSetup_(payload, requestId) {
    var result = MidtsVendorRequestService.createAndSendRequest({ leadId:payload.leadId || payload.lead_id, vendorName:payload.vendorName || payload.vendor_name, vendorEmail:payload.vendorEmail || payload.vendor_email, packageLink:payload.packageLink || payload.package_link, vendorSafeFilesConfirmed:payload.vendorSafeFilesConfirmed || payload.vendor_safe_files_confirmed });
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:'Vendor request sent for partner assessment and pricing.' }, result)) : MidtsResponseService.failure('VENDOR_REQUEST_SETUP_FAILED', result.message, { requestId:requestId });
  }

  function handleMarginReview_(payload, requestId) {
    var action = normalizeCompact_(payload.action || 'approvemargin');
    var result;
    if (action === 'updatemarginreview') result = MidtsGrossMarginService.save(payload);
    else if (action === 'approvemargin') result = MidtsGrossMarginService.approve(payload);
    else if (action === 'rejectmargin') result = MidtsMarginReviewService.rejectMargin(payload.leadId || payload.lead_id, payload.reviewer || payload.actor, payload.internalNotes || payload.notes || '');
    else result = MidtsMarginReviewService.returnMarginToVendor(payload.leadId || payload.lead_id, payload.reviewer || payload.actor, payload.internalNotes || payload.notes || '');
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:action === 'approvemargin' ? 'Gross margin saved and approved. Lead moved to Quote Builder.' : action === 'updatemarginreview' ? 'Gross margin adjustment saved.' : 'Margin review outcome recorded.' }, result)) : MidtsResponseService.failure(result.code || 'MARGIN_REVIEW_FAILED', result.message, { requestId:requestId });
  }

  function handleQuoteBuilder_(payload, requestId) {
    var result = MidtsQuoteBuilderService.prepareQuoteDraft(payload.leadId || payload.lead_id, payload.reviewer || payload.actor || 'MIDTS Quote Builder');
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:'Quote draft prepared. Lead moved to Quote Draft Review.' }, result)) : MidtsResponseService.failure(result.code || 'QUOTE_BUILDER_FAILED', result.message, { requestId:requestId });
  }
  function handleQuoteDraftReview_(payload, requestId) {
    var result = MidtsQuoteDraftReviewService.approveQuoteDraft(payload.leadId || payload.lead_id, payload.reviewer || payload.actor || 'MIDTS Quote Reviewer');
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:'Quote draft approved. Client-ready PDF generated.' }, result)) : MidtsResponseService.failure(result.code || 'QUOTE_DRAFT_REVIEW_FAILED', result.message, { requestId:requestId });
  }
  function handleQuoteSend_(payload, requestId) {
    var result = MidtsQuoteSendService.sendApprovedQuote(payload);
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:result.alreadySent ? 'Quote has already been sent to the client.' : 'Approved quote sent to client.' }, result)) : MidtsResponseService.failure(result.code || 'QUOTE_SEND_FAILED', result.message, { requestId:requestId });
  }
  function handleQuoteAcceptance_(payload, requestId) {
    var result = MidtsQuoteAcceptanceService.acceptQuote(payload);
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:result.alreadyAccepted ? 'Quote has already been accepted.' : 'Quote acceptance recorded. Lead is ready for Project Creation.' }, result)) : MidtsResponseService.failure(result.code || 'QUOTE_ACCEPTANCE_FAILED', result.message, { requestId:requestId });
  }
  function handleProjectCreation_(payload, requestId) {
    var result = MidtsProjectService.createProjectFromAcceptedQuote(payload.leadId || payload.lead_id, payload.creator || payload.reviewer || payload.actor || 'MIDTS Project Control');
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:result.alreadyCreated ? 'Project already exists for this accepted quote.' : 'Project created from accepted quote.' }, result)) : MidtsResponseService.failure(result.code || 'PROJECT_CREATION_FAILED', result.message, { requestId:requestId });
  }
  function handleInvoice_(payload, requestId) {
    var result = MidtsInvoiceService.createInvoiceFromProject(payload);
    return result.ok ? MidtsResponseService.success(Object.assign({ requestId:requestId, message:result.alreadyCreated ? 'Invoice already exists for this project.' : 'Invoice record created from active project.' }, result)) : MidtsResponseService.failure(result.code || 'INVOICE_CREATION_FAILED', result.message, { requestId:requestId });
  }

  function parsePostEvent(e) { if (!e) return {}; if (e.postData && e.postData.contents) { var c=e.postData.contents; var t=String(e.postData.type || '').toLowerCase(); if (t.indexOf('application/json') !== -1 || looksLikeJson(c)) return JSON.parse(c); return parseUrlEncoded(c); } return Object.assign({}, e.parameter || {}); }
  function isWorkspaceReadPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); var a=normalizeCompact_(p.action || ''); return s==='workspaceread' || ['listpendingtechnicalreviews','listpendingpartnerassessments','listpendingqualificationdecisions','getcommercialqualificationrecord','getcommercialqualificationrecorddocument','listpendingvendorsafepackages','listpendingvendorrequestsetups','listpendingmarginreviews','listpendingquotebuilders','listpendingquotedrafts','listpendingquotedraftreviews','listpendingapprovedquotes','listpendingquotesends','listpendingquoteacceptances','listpendingprojectcreations','listpendinginvoices','listpendinginvoicecreations','getquotedocument','getquotebyid','getquotebyleadid'].indexOf(a)!==-1; }
  function isStep2Payload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='step2' || s==='technicalintake'; }
  function isTechnicalReviewPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='technicalreview' || normalizeCompact_(p.action)==='recordtechnicalreview'; }
  function isQualificationDecisionPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='qualificationdecision' || normalizeCompact_(p.action)==='recordqualificationdecision'; }
  function isVendorSafePackagePayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='vendorsafepackage' || normalizeCompact_(p.action)==='recordvendorsafepackage'; }
  function isVendorRequestSetupPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='vendorrequestsetup' || normalizeCompact_(p.action)==='setupvendorrequest'; }
  function isMarginReviewPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); var a=normalizeCompact_(p.action || ''); return s==='marginreview' || ['approvemargin','updatemarginreview','rejectmargin','returnmargintovendor'].indexOf(a)!==-1; }
  function isQuoteBuilderPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='quotebuilder' || normalizeCompact_(p.action)==='preparequotedraft'; }
  function isQuoteDraftReviewPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='quotedraftreview' || normalizeCompact_(p.action)==='approvequotedraft'; }
  function isQuoteSendPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='quotesend' || s==='sendapprovedquote' || normalizeCompact_(p.action)==='sendapprovedquote'; }
  function isQuoteAcceptancePayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='quoteacceptance' || s==='clientquoteacceptance' || normalizeCompact_(p.action)==='acceptquote'; }
  function isProjectCreationPayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='projectcreation' || normalizeCompact_(p.action)==='createprojectfromacceptedquote'; }
  function isInvoicePayload_(p) { var s=normalizeCompact_(p.formStage || p.form_stage || p.stage || ''); return s==='invoicecreation' || s==='invoice' || normalizeCompact_(p.action)==='createinvoicefromproject'; }
  function normalizeCompact_(v) { return String(v || '').trim().toLowerCase().replace(/_/g,'').replace(/-/g,'').replace(/\s+/g,''); }
  function looksLikeJson(v) { var t=String(v || '').trim(); return t.charAt(0)==='{' || t.charAt(0)==='['; }
  function parseUrlEncoded(v) { var r={}; String(v || '').split('&').forEach(function(pair){ if(!pair)return; var p=pair.split('='); r[decodeURIComponent((p[0]||'').replace(/\+/g,' '))]=decodeURIComponent((p.slice(1).join('=')||'').replace(/\+/g,' ')); }); return r; }
  function scrubPayload(p) { var c=Object.assign({},p||{}); ['webhookToken','webhook_token','formToken','token','WEBSITE_WEBHOOK_TOKEN'].forEach(function(k){ if(c[k])c[k]='[redacted]'; }); return c; }
  function createRequestId() { return 'REQ-' + Utilities.formatDate(new Date(),'Europe/London','yyyyMMddHHmmssSSS'); }
  return { handlePost:handlePost, parsePostEvent:parsePostEvent, scrubPayload:scrubPayload };
})();