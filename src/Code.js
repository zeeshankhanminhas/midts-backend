function doPost(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'vendorRequestSetup') {
    return MidtsVendorRequestService.handleRequestSetupSubmission(e);
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
    return MidtsVendorRequestService.renderRequestSetup(e);
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
    reviewSummary: 'Technical review completed for lifecycle validation.',
    fileReview: ['Technical inputs reviewed for scope completeness.'],
    risks: ['Confirm final source data before work commences.'],
    clarifications: ['No additional clarification required for this test record.'],
    internalNotes: 'Internal notes captured by the Workspace Technical Review slice.',
    recommendation: 'Qualified'
  });
}

function testWorkspaceQualificationRead() {
  return postSampleWorkspaceRead_('listPendingQualificationDecisions', 'Apps Script Qualification Read Test').getContent();
}

function testQualificationDecisionGatewayQualified() {
  return postSampleQualificationDecision_('qualified').getContent();
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

function testVendorSafePackageReady() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsVendorPricingService.markVendorSafePackageReady(leadId, 'Apps Script Test');
}

function testVendorPricingWithSamplePayload() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsVendorPricingService.recordVendorPricing({
    leadId: leadId,
    vendorName: 'Sample Vendor',
    vendorEmail: getTestEmail_(),
    vendorCost: 1000,
    vendorCurrency: 'GBP',
    marginType: 'percentage',
    marginValue: 25,
    revisionReason: 'Initial vendor pricing test',
    notes: 'Creates a Vendor Pricing row and moves the lead to Margin Review.'
  });
}

function testMarginApproval() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsVendorPricingService.approveLatestMargin(leadId, 'Apps Script Test');
}

function testQuotePreparation() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsQuoteService.prepareQuoteDraft(leadId, 'Apps Script Test');
}

function testQuoteDocumentLinkRefresh() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsQuoteService.refreshQuoteDocumentLink(leadId);
}

function testQuoteApproval() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsQuoteService.approveQuoteDraft(leadId, 'Apps Script Test');
}

function testWorkflowActionUrls() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return {
    vendorSafeReady: MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.VENDOR_SAFE_READY),
    approveMargin: MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.APPROVE_MARGIN),
    prepareQuote: MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.PREPARE_QUOTE),
    approveQuote: MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.APPROVE_QUOTE),
    sendQuote: MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.SEND_QUOTE)
  };
}

function testWorkflowActionEmail() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsEmailService.sendWorkflowActionEmailForLead(leadId);
}

function testDocumentsSheet() {
  return MidtsDocumentService.ensureDocumentsSheet();
}

function testDocumentDataContracts() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var leadResult = MidtsSheetService.findLeadById(leadId);
  if (!leadResult) throw new Error('Lead not found: ' + leadId);

  var pricingResult = MidtsSheetService.findLatestVendorPricingByLeadId(leadId);
  if (!pricingResult) throw new Error('Vendor pricing not found for lead: ' + leadId);

  var intakeResult = MidtsSheetService.findLatestTechnicalIntakeByLeadId(leadId);
  var result = {
    control: MidtsDocumentAdapterService.toDocumentControl(leadResult.lead, 'quote', {
      reference: pricingResult.pricing['Quote Reference'] || leadResult.lead['Quote Reference'] || leadId,
      revision: pricingResult.pricing['Quote Revision'] || '1',
      status: 'draft'
    }),
    quote: MidtsDocumentAdapterService.toQuoteData(leadResult.lead, {}, pricingResult.pricing, { status: 'draft' }),
    requirementSheet: intakeResult
      ? MidtsDocumentAdapterService.toRequirementSheetData(leadResult.lead, intakeResult.intake, { status: 'draft' })
      : null,
    email: MidtsDocumentAdapterService.toEmailPayload('quoteIssued', leadResult.lead, pricingResult.pricing, {})
  };
  console.log(JSON.stringify(result));
  return result;
}

function testLeadDriveStructure() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsDriveService.ensureLeadStructure(leadId);
}

function testQuoteSendEmail() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsQuoteDeliveryService.sendQuoteSendEmail(leadId);
}

function testQuoteAccessEmail() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsQuoteDeliveryService.sendQuoteAccessEmail(leadId);
}

function testVendorPricingRequestSetupEmail() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var result = MidtsVendorRequestService.sendRequestSetupEmail(leadId);
  console.log(JSON.stringify({ leadId: leadId, result: result }));
  return result;
}

function testVendorPricingRequestSetupUrl() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsVendorRequestService.buildRequestSetupUrl(leadId);
}

function testRefreshPipeline() {
  return MidtsPipelineService.refresh();
}

function testMarginCalculation() {
  return MidtsVendorPricingService.calculateClientPrice(1000, 'percentage', 25);
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

function postSampleWorkspaceRead_(action, source) {
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    formStage: 'workspaceRead',
    action: action,
    source: source || 'Apps Script Workspace Read Test'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  });
}

function postSampleQualificationDecision_(decision) {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    formStage: 'qualificationDecision',
    action: 'recordQualificationDecision',
    leadId: leadId,
    decision: decision,
    reviewer: 'Apps Script Gateway Test',
    source: 'Apps Script Qualification Decision Test',
    pageUrl: 'manual-qualification-decision-test'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  });
}


function testCreateProjectFromAcceptedQuote() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  return MidtsProjectService.createProjectFromAcceptedQuote(leadId, 'MIDTS Test Control');
}

function testRecordDelivery() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var projectResult = MidtsSheetService.findProjectByLeadId(leadId);
  if (!projectResult) throw new Error('Create the project before recording delivery.');
  return MidtsDeliveryService.recordDelivery(projectResult.project['Project ID'], {
    summary: 'Lifecycle test delivery record created from the controlled test path.',
    deliveredFiles: 'Drive delivery package for ' + leadId,
    clientReviewStatus: 'Internal test'
  }, 'MIDTS Test Control');
}

function testRecordHandover() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var projectResult = MidtsSheetService.findProjectByLeadId(leadId);
  if (!projectResult) throw new Error('Create the project before recording handover.');
  return MidtsHandoverService.recordHandover(projectResult.project['Project ID'], {
    releaseNotes: 'Lifecycle test handover package released for controlled validation.',
    releasedFiles: 'Drive handover package for ' + leadId,
    clientAcceptanceStatus: 'Internal test'
  }, 'MIDTS Test Control');
}

function testIssueInvoice() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var projectResult = MidtsSheetService.findProjectByLeadId(leadId);
  if (!projectResult) throw new Error('Create the project before issuing an invoice.');
  return MidtsInvoiceService.issueInvoice(projectResult.project['Project ID'], {
    amount: 1,
    currency: MidtsConfig.getScriptProperty('CLIENT_QUOTE_CURRENCY') || 'GBP',
    paymentTerms: 'Internal lifecycle test - no client invoice issued.',
    dueDate: Utilities.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'Europe/London', 'yyyy-MM-dd')
  }, 'MIDTS Test Control');
}

function testOperationalDocumentAdapters() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var projectResult = MidtsSheetService.findProjectByLeadId(leadId);
  if (!projectResult) throw new Error('Project record not found for lead: ' + leadId);
  var delivery = MidtsSheetService.findLatestDeliveryRecordByProjectId(projectResult.project['Project ID']);
  var handover = MidtsSheetService.findLatestHandoverRecordByProjectId(projectResult.project['Project ID']);
  var invoice = MidtsSheetService.findLatestInvoiceByProjectId(projectResult.project['Project ID']);
  var result = {
    completionReport: delivery ? MidtsDocumentAdapterService.toCompletionReportData(projectResult.project, delivery.deliveryRecord, { status:'issued' }) : null,
    handoverPack: handover ? MidtsDocumentAdapterService.toHandoverPackData(projectResult.project, delivery ? delivery.deliveryRecord : {}, handover.handoverRecord, { status:'issued' }) : null,
    invoice: invoice ? MidtsDocumentAdapterService.toInvoiceData(projectResult.project, invoice.invoice, { status:'issued' }) : null
  };
  console.log(JSON.stringify(result));
  return result;
}

function isWorkflowAction_(action) {
  var normalized = String(action || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  return normalized === 'vendorsafeready' ||
    normalized === 'approvemargin' ||
    normalized === 'preparequote' ||
    normalized === 'approvequote' ||
    normalized === 'sendquote';
}

function getTestEmail_() {
  return MidtsConfig.getScriptProperty('TEST_EMAIL') || MidtsConfig.getScriptProperty('INTAKE_EMAIL') || 'midts.systems@gmail.com';
}
