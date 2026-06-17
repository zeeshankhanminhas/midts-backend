function doPost(e) {
  return MidtsWebhookRouter.handlePost(e);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'decision') {
    return MidtsDecisionService.handleDecisionRequest(e);
  }

  return MidtsResponseService.success({
    service: 'MIDTS Backend',
    status: 'ready',
    message: 'Use POST requests for website enquiry submissions.'
  });
}

function setupLaunchSheets() {
  return MidtsSheetService.ensureLaunchSheets();
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
  return postSampleStep1_('router-sample-', 'Router Sample Client').getContent();
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
  return postSampleStep1_('step1-sample-', 'Step 1 Sample Client').getContent();
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

function testDecisionQualified() {
  return testDecision_('qualified');
}

function testDecisionNeedsMoreInfo() {
  return testDecision_('needs-more-info');
}

function testDecisionNurture() {
  return testDecision_('nurture');
}

function testDecisionNotSuitable() {
  return testDecision_('not-suitable');
}

function testDecision_(decision) {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsDecisionService.applyDecision(leadId, decision, 'Apps Script Test');
}

function postSampleStep1_(submissionId, fullName) {
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    lead_id: submissionId,
    full_name: fullName,
    work_email: getTestEmail_(),
    company: 'Sample Company',
    project_type: 'CAD support',
    brief_requirement: 'Testing Step 1 lead capture before technical qualification.',
    source: 'Apps Script Lifecycle Test',
    pageUrl: 'manual-lifecycle-test'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  });
}

function postSampleStep2_(leadId, submissionId) {
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    formStage: 'step2',
    leadId: leadId,
    submissionId: submissionId,
    serviceType: 'CAD support',
    technicalScope: 'Sample Step 2 technical requirement for lifecycle validation.',
    materials: 'Aluminium 6082 or equivalent',
    quantity: '1 prototype set',
    deadline: 'Two weeks from approval',
    filesProvided: 'Yes',
    fileLinks: 'Provided by client email for test purposes',
    ndaRequired: 'Yes',
    confidentialityNotes: 'Use vendor-safe package before external pricing.',
    budgetRange: 'To be quoted after vendor pricing',
    timingNotes: 'Standard turnaround acceptable',
    technicalNotes: 'Lifecycle test should create Technical Intake row and internal review email.'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  });
}

function getTestEmail_() {
  return MidtsConfig.getScriptProperty('TEST_EMAIL') || MidtsConfig.getScriptProperty('INTAKE_EMAIL') || 'intake@midts.com';
}
