function doPost(e) {
  return MidtsWebhookRouter.handlePost(e);
}

function doGet() {
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
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    lead_id: 'router-sample-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss'),
    full_name: 'Router Sample Client',
    work_email: 'router.sample@example.com',
    company: 'Sample Company',
    project_type: 'Reverse engineering',
    brief_requirement: 'Sample router test lead.',
    source: 'Apps Script Router Test',
    pageUrl: 'manual-router-test'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  }).getContent();
}

function testAcknowledgementEmail() {
  var leadResult = {
    ok: true,
    leadId: 'MIDTS-EMAIL-TEST',
    submissionId: 'email-test-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss'),
    lifecycleStatus: 'New Lead',
    reviewStatus: 'Pending Review',
    nextAction: 'Review lead',
    lead: {
      submissionId: 'email-test',
      fullName: 'MIDTS Test Recipient',
      email: Session.getActiveUser().getEmail(),
      company: 'MIDTS',
      projectType: 'Email test',
      briefRequirement: 'Testing the MIDTS client acknowledgement email.',
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
    lifecycleStatus: 'New Lead',
    reviewStatus: 'Pending Review',
    nextAction: 'Review lead',
    lead: {
      submissionId: 'internal-test',
      fullName: 'Internal Review Test',
      email: Session.getActiveUser().getEmail(),
      company: 'MIDTS',
      projectType: 'Lifecycle test',
      briefRequirement: 'Testing the MIDTS internal review notification.',
      source: 'Apps Script Internal Test'
    }
  };

  return MidtsEmailService.sendInternalReviewNotification(leadResult);
}

function testLifecycleIntakeWithSamplePost() {
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    lead_id: 'lifecycle-sample-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss'),
    full_name: 'Lifecycle Sample Client',
    work_email: Session.getActiveUser().getEmail(),
    company: 'Sample Company',
    project_type: 'CAD support',
    brief_requirement: 'Testing the full intake lifecycle: lead row, client acknowledgement, internal notification, and logs.',
    source: 'Apps Script Lifecycle Test',
    pageUrl: 'manual-lifecycle-test'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  }).getContent();
}
