function doPost(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'vendorRequestSetup') {
    return htmlRedirectPage_('Vendor Request Setup moved to Workspace', buildWorkspaceVendorRequestUrl_(e && e.parameter && e.parameter.leadId), 'Vendor Request Setup is now controlled from the MIDTS Workspace.');
  }
  if (action === 'partnerAssessment') {
    return MidtsVendorRequestService.handlePartnerAssessmentSubmission(e);
  }
  if (action === 'vendorPricing') {
    return MidtsVendorRequestService.handleVendorPricingSubmission(e);
  }
  if (action === 'quoteResponse') {
    return MidtsQuoteDeliveryService.handleClientResponse(e);
  }
  return MidtsWebhookRouter.handlePost(e);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'vendorRequestSetup') {
    return htmlRedirectPage_('Opening Workspace Vendor Request Setup', buildWorkspaceVendorRequestUrl_(e.parameter.leadId), 'Vendor Request Setup is now controlled from the MIDTS Workspace.');
  }
  if (e && e.parameter && e.parameter.action === 'partnerAssessment') {
    return MidtsVendorRequestService.renderPartnerAssessmentForm(e);
  }
  if (e && e.parameter && e.parameter.action === 'vendorPricing') {
    return MidtsVendorRequestService.renderVendorPricingForm(e);
  }
  if (e && e.parameter && e.parameter.action === 'quoteResponse') {
    return MidtsQuoteDeliveryService.renderClientResponse(e);
  }

  if (e && e.parameter && e.parameter.action === 'decision') {
    return MidtsDecisionService.handleDecisionRequest(e);
  }

  if (e && e.parameter && isWorkflowAction_(e.parameter.action)) {
    return MidtsWorkflowActionService.handleActionRequest(e);
  }

  return MidtsResponseService.success({
    service: 'MIDTS Backend',
    status: 'ready',
    message: 'Use POST requests for website enquiry submissions.'
  });
}

function buildWorkspaceVendorRequestUrl_(leadId) {
  var baseUrl = MidtsConfig.getScriptProperty('WORKSPACE_BASE_URL') || 'https://new-midts.vercel.app';
  var cleanBase = String(baseUrl || '').replace(/\/+$/, '');
  var cleanLeadId = String(leadId || '').trim();
  return cleanBase + '/workspace/vendor-request/review' + (cleanLeadId ? '?leadId=' + encodeURIComponent(cleanLeadId) : '');
}

function htmlRedirectPage_(title, url, message) {
  var safeTitle = escapeHtmlForCode_(title || 'Opening MIDTS Workspace');
  var safeUrl = escapeHtmlForCode_(url || 'https://new-midts.vercel.app/workspace/vendor-request');
  var safeMessage = escapeHtmlForCode_(message || 'Continue in MIDTS Workspace.');
  return HtmlService.createHtmlOutput([
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta http-equiv="refresh" content="0;url=' + safeUrl + '">',
    '<title>' + safeTitle + '</title></head>',
    '<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;padding:32px;max-width:760px;margin:0 auto">',
    '<h1 style="font-size:24px;margin:0 0 16px">' + safeTitle + '</h1>',
    '<p>' + safeMessage + '</p>',
    '<p><a href="' + safeUrl + '">Open MIDTS Workspace</a></p>',
    '</body></html>'
  ].join(''));
}

function escapeHtmlForCode_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setupLaunchSheets() {
  var result = MidtsSheetService.ensureLaunchSheets();
  MidtsVendorRequestService.ensureVendorRequestSheet();
  result.vendorRequestsSheet = 'Vendor Requests';
  result.pipelineSheet = MidtsPipelineService.ensurePipelineSheet();
  result.quoteResponsesSheet = MidtsQuoteDeliveryService.ensureQuoteResponseSheet();
  result.documentsSheet = MidtsDocumentService.ensureDocumentsSheet();
  MidtsPipelineService.refresh();
  return result;
}

function testWebsiteWebhookWithSampleLead() {
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    lead_id: 'sample-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss'),
    full_name: 'Sample Client',
    work_email: 'sample@example.com',
    company: 'Sample Company',
    project_type: 'CAD support',
    brief_requirement: 'Sample launch readiness test lead.',
    source: 'Apps Script Test',
    pageUrl: 'manual-test'
  };

  return MidtsLeadService.createLead(sample);
}

function testWebhookRouterWithSamplePost() {
  var submissionId = 'router-sample-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss');
  return postSampleStep1_(submissionId, 'Router Sample Client').getContent();
}

function testAcknowledgementEmail() {
  var leadResult = {
    ok: true,
    leadId: 'MIDTS-EMAIL-TEST',
    submissionId: 'email-test-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss'),
    lifecycleStatus: 'Awaiting Step 2',
    reviewStatus: 'Not Ready',
    nextAction: 'Client to complete Step 2',
    lead: {
      submissionId: 'email-test',
      fullName: 'MIDTS Test Recipient',
      email: getTestEmail_(),
      company: 'MIDTS',
      projectType: 'Email test',
      briefRequirement: 'Testing the MIDTS client acknowledgement and Step 2 request email.',
      source: 'Apps Script Email Test'
    }
  };

  return MidtsEmailService.sendLeadAcknowledgement(leadResult);
}

function testInternalReviewNotification() {
  var leadResult = {
    ok: true,
    leadId: 'MIDTS-INTERNAL-TEST',
    submissionId: 'internal-test-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss'),
    technicalIntakeId: 'TI-INTERNAL-TEST',
    lifecycleStatus: 'Pending Review',
    reviewStatus: 'Pending Review',
    nextAction: 'Review technical requirement',
    vendorSafePackageRequired: 'Yes',
    lead: {
      submissionId: 'internal-test',
      fullName: 'Internal Review Test',
      email: getTestEmail_(),
      company: 'MIDTS',
      projectType: 'Lifecycle test',
      briefRequirement: 'Testing the MIDTS internal review notification after Step 2.',
      source: 'Apps Script Internal Test'
    }
  };

  return MidtsEmailService.sendInternalReviewNotification(leadResult);
}

function testStep1WithSamplePost() {
  var submissionId = 'step1-sample-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss');
  return postSampleStep1_(submissionId, 'Step 1 Sample Client').getContent();
}

function testStep2WithSamplePost() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var submissionId = MidtsConfig.getScriptProperty('TEST_SUBMISSION_ID') || leadId;
  return postSampleStep2_(leadId, submissionId).getContent();
}

function testLifecycleIntakeWithSamplePost() {
  var timestamp = Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss');
  var submissionId = 'lifecycle-sample-' + timestamp;
  var step1Response = postSampleStep1_(submissionId, 'Lifecycle Sample Client');
  var step1Data = JSON.parse(step1Response.getContent());
  var leadId = step1Data && step1Data.data && step1Data.data.leadId;

  if (!leadId) {
    throw new Error('Step 1 test did not return a leadId: ' + step1Response.getContent());
  }

  var step2Response = postSampleStep2_(leadId, submissionId);

  return JSON.stringify({
    ok: true,
    step1: JSON.parse(step1Response.getContent()),
    step2: JSON.parse(step2Response.getContent())
  });
}

function testTechnicalReviewQualified() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsTechnicalReviewService.recordReview({
    leadId: leadId,
    reviewer: 'Apps Script Test',
    reviewerOrganisation: 'MIDTS Test Partner',
    reviewerEmail: getTestEmail_(),
    assessmentScope: 'Technical assessment scope for lifecycle validation.',
    filesAndRevisionsReviewed: 'Sample file rev A',
    partnerReviewPackageLink: 'https://drive.google.com/sample-package',
    partnerAssessmentDocumentLink: 'https://drive.google.com/sample-assessment',
    feasibilityStatus: 'Feasible',
    partnerSubmittedAt: new Date(),
    reviewSummary: 'Partner Technical Assessment completed for lifecycle validation.',
    risks: ['Confirm final source data before work commences.'],
    clarifications: ['No additional clarification required for this test record.'],
    internalNotes: 'Internal notes captured by the Workspace Partner Technical Assessment slice.',
    partnerDeclaration: 'Test declaration',
    recommendation: 'Qualified'
  });
}
