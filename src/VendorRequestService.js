var MidtsVendorRequestService = (function () {
  var SHEET_NAME = 'Vendor Requests';
  var HEADERS = [
    'Request ID', 'Lead ID', 'Technical Review ID', 'Quote Reference', 'Created At', 'Sent At',
    'Vendor Name', 'Vendor Email', 'Vendor Package Link', 'Reviewer Organisation',
    'Files And Revisions Priced', 'Source Package ID', 'Scope Revision', 'Request Token Hash',
    'Request Status', 'Partner Assessment Status', 'Partner Assessment Link', 'Pricing Readiness',
    'Submitted At', 'Vendor Cost', 'Vendor Currency', 'Lead Time', 'Quote Valid Until',
    'Exclusions', 'Vendor Reference', 'Vendor Notes', 'Pricing ID', 'Last Updated At'
  ];

  function renderRequestSetup(e) {
    var params = e && e.parameter || {};
    if (!isInternalTokenValid_(params.token) || !params.leadId) return htmlPage_('Vendor request unavailable', '<p>This internal request link is invalid or incomplete.</p>');
    var leadResult = MidtsSheetService.findLeadById(params.leadId);
    if (!leadResult) return htmlPage_('Vendor request unavailable', '<p>The referenced lead could not be found.</p>');
    if (String(leadResult.lead['Lifecycle Status'] || '') !== 'Vendor Pricing') return htmlPage_('Vendor request unavailable', '<p>This lead is not ready for partner assessment and vendor pricing.</p>');

    var lead = leadResult.lead;
    var packageResult = MidtsSheetService.findLatestVendorSafePackageByLeadId(params.leadId);
    var packageLink = packageResult && packageResult.vendorSafePackage && packageResult.vendorSafePackage['Drive Folder URL'] || '';
    var packageNotice = packageLink ? '<p class="notice">Vendor-safe package link has been prefilled from the latest package record.</p>' : '<p class="notice">No vendor-safe package link was found for this lead. Paste the approved Drive folder link before sending.</p>';
    var body = [
      '<p class="meta">MIDTS INTERNAL COMMERCIAL WORKFLOW</p>',
      '<h1>Send partner assessment request</h1>',
      '<p class="lede">Select the partner and provide the approved vendor-safe package link. MIDTS will send the partner a secure assessment link first. Vendor pricing remains blocked until the partner assessment is feasible and pricing-ready.</p>',
      packageNotice,
      '<p class="notice"><strong>Before sending:</strong> confirm the linked folder contains only approved vendor-safe files. Do not include internal pricing, margin, or client-confidential material outside the approved package.</p>',
      '<dl><dt>Lead</dt><dd>' + escapeHtml_(params.leadId) + '</dd><dt>Client</dt><dd>' + escapeHtml_(lead['Full Name'] || '') + '</dd><dt>Project</dt><dd>' + escapeHtml_(lead['Project Type'] || '') + '</dd></dl>',
      '<form method="post" action="' + escapeHtml_(MidtsConfig.getWebAppUrl()) + '">',
      hiddenInput_('action', 'vendorRequestSetup'), hiddenInput_('leadId', params.leadId), hiddenInput_('token', params.token),
      field_('Partner organisation', 'vendorName', '', 'text', true),
      field_('Partner email', 'vendorEmail', '', 'email', true),
      field_('Vendor-safe package link', 'packageLink', packageLink, 'url', true),
      '<label class="check"><input type="checkbox" name="vendorSafeFilesConfirmed" value="yes" required> I confirm the linked folder contains the approved vendor-safe files for partner assessment and pricing.</label>',
      '<button type="submit">Send assessment request</button></form>'
    ].join('');
    return htmlPage_('Send partner assessment request', body);
  }

  function handleRequestSetupSubmission(e) {
    try {
      var params = e && e.parameter || {};
      if (!isInternalTokenValid_(params.token)) return htmlPage_('Vendor request failed', '<p>The internal action token is invalid.</p>');
      var result = createAndSendRequest_(params);
      if (!result.ok) return htmlPage_('Vendor request blocked', '<p>' + escapeHtml_(result.message) + '</p>');
      return htmlPage_('Partner assessment request sent', '<p>The assessment request was sent to ' + escapeHtml_(result.vendorEmail) + ' for lead ' + escapeHtml_(result.leadId) + '.</p><p>Vendor pricing remains blocked until the partner assessment is received and marked pricing-ready.</p>');
    } catch (error) {
      return htmlPage_('Vendor request failed', '<p>' + escapeHtml_(errorMessage_(error)) + '</p>');
    }
  }

  function createAndSendRequest(input) { return createAndSendRequest_(input || {}); }

  function renderPartnerAssessmentForm(e) {
    var params = e && e.parameter || {};
    var request = validateRequestToken_(params.requestId, params.token, 'assessment');
    if (!request.ok) return htmlPage_('Assessment request unavailable', '<p>' + escapeHtml_(request.message) + '</p>');
    var leadResult = MidtsSheetService.findLeadById(request.record['Lead ID']);
    if (!leadResult) return htmlPage_('Assessment request unavailable', '<p>The related MIDTS lead could not be found.</p>');
    if (String(request.record['Technical Review ID'] || '').trim()) {
      var pricingLink = buildVendorPricingUrl_(request.record['Request ID'], params.token);
      return htmlPage_('Partner assessment already received', '<p>MIDTS has already received this assessment.</p><p><a class="package" href="' + escapeHtml_(pricingLink) + '">Continue to pricing</a></p>');
    }
    var lead = leadResult.lead;
    var body = [
      '<p class="meta">MIDTS PARTNER TECHNICAL ASSESSMENT</p>',
      '<h1>Submit partner technical assessment</h1>',
      '<p class="lede">Review the approved vendor-safe package and record the technical assessment before submitting pricing. MIDTS controls commercial decisions and document release.</p>',
      '<dl><dt>Project reference</dt><dd>' + escapeHtml_(request.record['Quote Reference'] || request.record['Lead ID']) + '</dd><dt>Project</dt><dd>' + escapeHtml_(lead['Project Type'] || '') + '</dd><dt>Requirement summary</dt><dd>' + escapeHtml_(lead['Brief Requirement'] || '') + '</dd></dl>',
      '<p><a class="package" href="' + escapeHtml_(request.record['Vendor Package Link']) + '" target="_blank" rel="noopener">Open vendor-safe package</a></p>',
      '<form method="post" action="' + escapeHtml_(MidtsConfig.getWebAppUrl()) + '">',
      hiddenInput_('action', 'partnerAssessment'), hiddenInput_('requestId', params.requestId), hiddenInput_('token', params.token),
      field_('Assessor name', 'assessorName', '', 'text', true),
      field_('Assessor role', 'assessorRole', '', 'text', true),
      field_('Partner assessment document link', 'assessmentDocumentLink', '', 'url', true),
      textarea_('Files and revisions assessed', 'filesAndRevisionsReviewed', '', true),
      '<label>Feasibility outcome<select name="feasibilityStatus" required><option value="">Select outcome</option><option>Feasible</option><option>Feasible with Assumptions</option><option>Clarification Required</option><option>Not Feasible</option><option>Alternative Approach</option></select></label>',
      textarea_('Technical summary', 'technicalSummary', '', true),
      textarea_('Missing information / questions for client', 'clarifications', '', false),
      textarea_('Assumptions', 'assumptions', '', false),
      textarea_('Exclusions', 'exclusions', '', false),
      textarea_('Engineering or manufacturing risks', 'risks', '', false),
      textarea_('Recommended approach', 'recommendedApproach', '', false),
      textarea_('Recommended deliverables', 'deliverables', '', false),
      textarea_('Required client inputs', 'requiredInputs', '', false),
      field_('Estimated engineering lead time', 'estimatedLeadTime', '', 'text', false),
      '<label class="check"><input type="checkbox" name="pricingReady" value="yes"> Pricing is ready to proceed for the assessed basis.</label>',
      '<label class="check"><input type="checkbox" name="partnerDeclaration" value="Partner confirms this assessment reflects the files, revisions, assumptions, and scope stated above." required> I confirm this assessment reflects the files, revisions, assumptions, and scope stated above.</label>',
      '<button type="submit">Submit assessment</button></form>'
    ].join('');
    return htmlPage_('Submit partner technical assessment', body);
  }

  function handlePartnerAssessmentSubmission(e) {
    var lock = LockService.getScriptLock();
    var lockAcquired = false;
    try {
      lockAcquired = lock.tryLock(10000);
      if (!lockAcquired) return htmlPage_('Assessment submission delayed', '<p>Please submit the form again in a moment.</p>');
      var params = e && e.parameter || {};
      var request = validateRequestToken_(params.requestId, params.token, 'assessment');
      if (!request.ok) return htmlPage_('Assessment submission blocked', '<p>' + escapeHtml_(request.message) + '</p>');
      if (String(request.record['Technical Review ID'] || '').trim()) return htmlPage_('Assessment already received', '<p>This assessment has already been submitted. No duplicate latest assessment was created.</p>');

      var pricingReady = String(params.pricingReady || '').toLowerCase() === 'yes';
      var feasibility = String(params.feasibilityStatus || '').trim();
      var result = MidtsTechnicalReviewService.recordReview({
        leadId: request.record['Lead ID'],
        reviewRequestId: request.record['Request ID'],
        sourcePackageId: request.record['Source Package ID'],
        reviewerType: 'Approved Outsourced Partner',
        reviewer: params.assessorName || request.record['Vendor Name'],
        reviewerOrganisation: request.record['Vendor Name'],
        reviewerEmail: request.record['Vendor Email'],
        assessmentScope: params.technicalSummary || '',
        filesAndRevisionsReviewed: params.filesAndRevisionsReviewed || request.record['Files And Revisions Priced'] || '',
        partnerReviewPackageLink: request.record['Vendor Package Link'],
        partnerAssessmentDocumentLink: params.assessmentDocumentLink || '',
        feasibilityStatus: feasibility,
        pricingReady: pricingReady ? 'Yes' : 'No',
        proposedProcess: params.recommendedApproach || '',
        risks: params.risks || '',
        clarifications: [params.clarifications || '', params.requiredInputs || ''].filter(Boolean).join('\n'),
        assumptions: params.assumptions || '',
        deliverables: params.deliverables || '',
        estimatedLeadTime: params.estimatedLeadTime || '',
        reviewSummary: params.technicalSummary || '',
        internalNotes: params.exclusions || '',
        partnerSubmittedAt: new Date(),
        partnerDeclaration: params.partnerDeclaration || '',
        recommendation: recommendationForFeasibility_(feasibility)
      });
      if (!result.ok) return htmlPage_('Assessment submission blocked', '<p>' + escapeHtml_(result.message || result.code) + '</p>');

      var allowPricing = pricingReady && (result.feasibilityStatus === 'Feasible' || result.feasibilityStatus === 'Feasible with Assumptions');
      updateRequest_(request, {
        'Technical Review ID': result.reviewId,
        'Reviewer Organisation': result.reviewerOrganisation,
        'Files And Revisions Priced': result.filesAndRevisionsReviewed,
        'Partner Assessment Status': result.feasibilityStatus,
        'Partner Assessment Link': result.partnerAssessmentDocumentLink,
        'Pricing Readiness': allowPricing ? 'Yes' : 'No',
        'Request Status': allowPricing ? 'Assessment Received' : 'Assessment Blocked',
        'Submitted At': new Date(),
        'Last Updated At': new Date()
      });
      sendAssessmentReceivedEmail_(request.record, result, allowPricing);
      MidtsLogger.logWebhookAttempt({ requestId: 'PARTNER-ASSESSMENT-' + request.record['Request ID'], outcome: allowPricing ? 'partner_assessment_pricing_ready' : 'partner_assessment_pricing_blocked', message: 'Partner assessment received: ' + result.feasibilityStatus, payload: { leadId: result.leadId, requestId: request.record['Request ID'], reviewId: result.reviewId, pricingReady: allowPricing }, submissionId: '', email: request.record['Vendor Email'], source: 'Vendor Request Service' });

      if (allowPricing) {
        var pricingUrl = buildVendorPricingUrl_(request.record['Request ID'], params.token);
        return htmlPage_('Assessment received', '<p>Thank you. MIDTS has received your Partner Technical Assessment.</p><p>Your assessment is pricing-ready.</p><p><a class="package" href="' + escapeHtml_(pricingUrl) + '">Continue to pricing</a></p>');
      }
      return htmlPage_('Assessment received', '<p>Thank you. MIDTS has received your Partner Technical Assessment.</p><p>Vendor pricing is blocked until MIDTS resolves the recorded assessment outcome.</p>');
    } catch (error) {
      return htmlPage_('Assessment submission failed', '<p>' + escapeHtml_(errorMessage_(error)) + '</p>');
    } finally {
      if (lockAcquired) lock.releaseLock();
    }
  }

  function renderVendorPricingForm(e) {
    var params = e && e.parameter || {};
    var request = validateVendorPricingRequest_(params.requestId, params.token);
    if (!request.ok) return htmlPage_('Pricing request unavailable', '<p>' + escapeHtml_(request.message) + '</p>');
    var leadResult = MidtsSheetService.findLeadById(request.record['Lead ID']);
    if (!leadResult) return htmlPage_('Pricing request unavailable', '<p>The related MIDTS lead could not be found.</p>');
    var lead = leadResult.lead;
    var body = [
      '<p class="meta">MIDTS VENDOR PRICING REQUEST</p><h1>Submit your pricing</h1><p class="lede">Please provide your commercial response for the approved assessment basis below.</p>',
      '<dl><dt>Reference</dt><dd>' + escapeHtml_(request.record['Quote Reference'] || request.record['Lead ID']) + '</dd><dt>Project</dt><dd>' + escapeHtml_(lead['Project Type'] || '') + '</dd><dt>Requirement</dt><dd>' + escapeHtml_(lead['Brief Requirement'] || '') + '</dd><dt>Partner assessment</dt><dd>' + escapeHtml_(request.record['Partner Assessment Status'] || '') + '</dd></dl>',
      '<p><a class="package" href="' + escapeHtml_(request.record['Vendor Package Link']) + '" target="_blank" rel="noopener">Open vendor-safe package</a></p>',
      '<form method="post" action="' + escapeHtml_(MidtsConfig.getWebAppUrl()) + '">',
      hiddenInput_('action', 'vendorPricing'), hiddenInput_('requestId', params.requestId), hiddenInput_('token', params.token),
      field_('Your quote reference', 'vendorReference', '', 'text', false),
      field_('Quoted cost', 'vendorCost', '', 'number', true, 'step="0.01" min="0"'),
      field_('Currency', 'vendorCurrency', 'GBP', 'text', true),
      field_('Lead time', 'leadTime', '', 'text', true),
      field_('Quote valid until', 'quoteValidUntil', '', 'date', true),
      textarea_('Exclusions or assumptions', 'exclusions', '', true),
      textarea_('Additional notes', 'notes', '', false),
      '<button type="submit">Submit pricing</button></form>'
    ].join('');
    return htmlPage_('Submit vendor pricing', body);
  }

  function handleVendorPricingSubmission(e) {
    var lock = LockService.getScriptLock();
    var lockAcquired = false;
    try {
      lockAcquired = lock.tryLock(10000);
      if (!lockAcquired) return htmlPage_('Pricing submission delayed', '<p>Please submit the form again in a moment.</p>');
      var params = e && e.parameter || {};
      var request = validateVendorPricingRequest_(params.requestId, params.token);
      if (!request.ok) return htmlPage_('Pricing submission blocked', '<p>' + escapeHtml_(request.message) + '</p>');
      var cost = parseMoney_(params.vendorCost);
      if (cost === null || cost < 0) return htmlPage_('Pricing submission blocked', '<p>A valid quoted cost is required.</p>');
      if (!String(params.leadTime || '').trim() || !String(params.quoteValidUntil || '').trim() || !String(params.exclusions || '').trim()) return htmlPage_('Pricing submission blocked', '<p>Lead time, quote validity and exclusions or assumptions are required.</p>');

      var pricing = MidtsVendorPricingService.recordVendorPricing({ leadId: request.record['Lead ID'], vendorName: request.record['Vendor Name'], vendorEmail: request.record['Vendor Email'], vendorCost: cost, vendorCurrency: params.vendorCurrency || 'GBP', revisionReason: 'Vendor submission ' + request.record['Request ID'], notes: buildPricingNotes_(params) });
      if (!pricing.ok) return htmlPage_('Pricing submission blocked', '<p>' + escapeHtml_(pricing.message || pricing.code) + '</p>');
      updateRequest_(request, { 'Request Status': 'Submitted', 'Vendor Cost': cost, 'Vendor Currency': params.vendorCurrency || 'GBP', 'Lead Time': String(params.leadTime || '').trim(), 'Quote Valid Until': String(params.quoteValidUntil || '').trim(), 'Exclusions': String(params.exclusions || '').trim(), 'Vendor Reference': String(params.vendorReference || '').trim(), 'Vendor Notes': String(params.notes || '').trim(), 'Pricing ID': pricing.pricingId, 'Last Updated At': new Date() });
      MidtsEmailService.sendWorkflowActionEmailForLead(pricing.leadId);
      MidtsLogger.logWebhookAttempt({ requestId: 'VENDOR-SUBMISSION-' + request.record['Request ID'], outcome: 'vendor_pricing_submitted', message: 'Vendor pricing received and moved to margin review', payload: { leadId: pricing.leadId, pricingId: pricing.pricingId, vendorRequestId: request.record['Request ID'], technicalReviewId: request.record['Technical Review ID'] }, submissionId: '', email: request.record['Vendor Email'], source: 'Vendor Request Service' });
      return htmlPage_('Pricing submitted', '<p>Thank you. MIDTS has received your commercial response and will review it internally.</p>');
    } catch (error) {
      return htmlPage_('Pricing submission failed', '<p>' + escapeHtml_(errorMessage_(error)) + '</p>');
    } finally {
      if (lockAcquired) lock.releaseLock();
    }
  }

  function sendRequestSetupEmail(leadId) {
    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok: false, message: 'Lead not found: ' + leadId };
    var lead = leadResult.lead;
    if (String(lead['Lifecycle Status'] || '') !== 'Vendor Pricing') return { ok: false, message: 'Lead is not in Vendor Pricing.' };
    var url = buildRequestSetupUrl(leadId);
    var subject = 'Send partner assessment request - ' + leadId;
    var body = ['The vendor-safe package is ready. Select the partner and send the assessment request.', 'Vendor pricing remains blocked until the partner assessment is feasible and pricing-ready.', '', 'Lead ID: ' + leadId, 'Client: ' + (lead['Full Name'] || ''), 'Project: ' + (lead['Project Type'] || ''), '', 'Send partner assessment request: ' + url].join('\n');
    try {
      MailApp.sendEmail({ to: getIntakeEmail_(), name: 'MIDTS Backend', subject: subject, body: body, htmlBody: htmlEmail_(leadId, lead, url) });
      MidtsSheetService.appendEmailLog([new Date(), leadId, lead['Submission ID'] || '', getIntakeEmail_(), '', subject, 'sent', 'Partner assessment request setup email sent']);
      return { ok: true, status: 'sent', message: 'Partner assessment request setup email sent.' };
    } catch (error) {
      var message = errorMessage_(error);
      MidtsSheetService.appendEmailLog([new Date(), leadId, lead['Submission ID'] || '', getIntakeEmail_(), '', subject, 'failed', message]);
      return { ok: false, status: 'failed', message: message };
    }
  }

  function buildRequestSetupUrl(leadId) { return MidtsConfig.getWebAppUrl() + '?action=vendorRequestSetup&leadId=' + encodeURIComponent(leadId) + '&token=' + encodeURIComponent(MidtsConfig.getDecisionToken()); }

  function createAndSendRequest_(input) {
    var lock = LockService.getScriptLock();
    var lockAcquired = false;
    try {
      lockAcquired = lock.tryLock(10000);
      if (!lockAcquired) return { ok: false, message: 'Vendor request is busy. Submit again in a moment.' };
      var leadId = String(input.leadId || '').trim();
      var vendorName = String(input.vendorName || '').trim();
      var vendorEmail = String(input.vendorEmail || '').trim();
      var packageLink = String(input.packageLink || '').trim();
      var vendorSafeFilesConfirmed = String(input.vendorSafeFilesConfirmed || '').toLowerCase() === 'yes';
      if (!leadId || !vendorName || !vendorEmail || !packageLink) return { ok: false, message: 'Partner organisation, partner email and vendor-safe package link are required.' };
      if (!vendorSafeFilesConfirmed) return { ok: false, message: 'Confirm the vendor-safe folder contains the approved files before sending.' };
      if (!isEmail_(vendorEmail)) return { ok: false, message: 'Enter a valid partner email address.' };
      if (!/^https:\/\//i.test(packageLink)) return { ok: false, message: 'Vendor-safe package link must use https://.' };
      var leadResult = MidtsSheetService.findLeadById(leadId);
      if (!leadResult) return { ok: false, message: 'Lead not found: ' + leadId };
      if (String(leadResult.lead['Lifecycle Status'] || '') !== 'Vendor Pricing') return { ok: false, message: 'Lead is not in Vendor Pricing.' };
      if (String(leadResult.lead['Status'] || '') !== 'Qualified') return { ok: false, message: 'Lead must be qualified before partner assessment is requested.' };
      if (findOpenRequestForLeadAndVendor_(leadId, vendorEmail)) return { ok: false, message: 'An open partner request already exists for this partner and lead.' };
      var packageResult = MidtsSheetService.findLatestVendorSafePackageByLeadId(leadId);
      var vendorPackage = packageResult && packageResult.vendorSafePackage || {};
      var approvedPackageLink = String(vendorPackage['Drive Folder URL'] || '').trim();
      if (String(leadResult.lead['Vendor Safe Package Required'] || '').toLowerCase() === 'yes') {
        if (!approvedPackageLink || String(vendorPackage['Package Status'] || '') !== 'Approved for Vendor Pricing') return { ok: false, message: 'Approved vendor-safe package is required before partner assessment is requested.' };
        if (packageLink !== approvedPackageLink) return { ok: false, message: 'Vendor-safe package link must match the latest approved package record.' };
      }
      var now = new Date();
      var requestId = 'VRQ-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
      var rawToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
      var request = { 'Request ID': requestId, 'Lead ID': leadId, 'Technical Review ID': '', 'Quote Reference': leadResult.lead['Quote Reference'] || '', 'Created At': now, 'Sent At': '', 'Vendor Name': vendorName, 'Vendor Email': vendorEmail, 'Vendor Package Link': packageLink, 'Reviewer Organisation': '', 'Files And Revisions Priced': '', 'Source Package ID': vendorPackage['Package ID'] || '', 'Scope Revision': vendorPackage['Package Hash'] || '', 'Request Token Hash': hashToken_(rawToken), 'Request Status': 'Pending Send', 'Partner Assessment Status': 'Requested', 'Partner Assessment Link': '', 'Pricing Readiness': 'No', 'Submitted At': '', 'Vendor Cost': '', 'Vendor Currency': '', 'Lead Time': '', 'Quote Valid Until': '', 'Exclusions': '', 'Vendor Reference': '', 'Vendor Notes': '', 'Pricing ID': '', 'Last Updated At': now };
      appendRequest_(request);
      var emailResult = sendVendorRequestEmail_(request, leadResult.lead, buildPartnerAssessmentUrl_(requestId, rawToken));
      var requestResult = findRequestById_(requestId);
      if (!emailResult.ok) { updateRequest_(requestResult, { 'Request Status': 'Send Failed', 'Last Updated At': new Date() }); return { ok: false, message: 'Partner assessment request could not be emailed: ' + emailResult.message }; }
      updateRequest_(requestResult, { 'Request Status': 'Sent', 'Sent At': new Date(), 'Last Updated At': new Date() });
      MidtsSheetService.updateLeadById(leadId, { 'Next Action': 'Await partner assessment', 'Next Action Due': new Date(), 'Vendor Pricing Status': 'Partner Assessment Requested', 'Last Updated At': new Date() });
      MidtsLogger.logWebhookAttempt({ requestId: requestId, outcome: 'partner_assessment_request_sent', message: 'Partner assessment request sent', payload: { leadId: leadId, sourcePackageId: request['Source Package ID'], vendorName: vendorName, vendorEmail: vendorEmail }, submissionId: leadResult.lead['Submission ID'] || '', email: vendorEmail, source: 'Vendor Request Service' });
      return { ok: true, leadId: leadId, requestId: requestId, vendorEmail: vendorEmail, sourcePackageId: request['Source Package ID'] };
    } finally {
      if (lockAcquired) lock.releaseLock();
    }
  }

  function sendVendorRequestEmail_(request, lead, assessmentUrl) {
    var subject = 'MIDTS partner technical assessment request - ' + (request['Quote Reference'] || request['Lead ID']);
    var body = ['Hello ' + request['Vendor Name'] + ',', '', 'MIDTS requests your Partner Technical Assessment for the vendor-safe package linked below.', 'Please complete the assessment before submitting any commercial pricing.', '', 'Package: ' + request['Vendor Package Link'], 'Submit assessment: ' + assessmentUrl, '', 'Do not include MIDTS margin, client selling price, or unrelated client information in your response.', '', 'MIDTS'].join('\n');
    try {
      MailApp.sendEmail({ to: request['Vendor Email'], replyTo: getIntakeEmail_(), name: 'MIDTS', subject: subject, body: body, htmlBody: '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px"><p>Hello ' + escapeHtml_(request['Vendor Name']) + ',</p><p>MIDTS requests your <strong>Partner Technical Assessment</strong> for the vendor-safe package.</p><p><a href="' + escapeHtml_(request['Vendor Package Link']) + '">Open vendor-safe package</a></p><p><a href="' + escapeHtml_(assessmentUrl) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">Submit assessment</a></p><p>Please complete the assessment before submitting any commercial pricing.</p><p>MIDTS</p></div>' });
      MidtsSheetService.appendEmailLog([new Date(), request['Lead ID'], '', request['Vendor Email'], '', subject, 'sent', 'Partner assessment request sent']);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: errorMessage_(error) };
    }
  }

  function sendAssessmentReceivedEmail_(request, assessment, pricingReady) {
    var subject = 'Partner assessment received - ' + (request['Quote Reference'] || request['Lead ID']);
    var workspaceBase = String(MidtsConfig.getScriptProperty('WORKSPACE_BASE_URL') || 'https://new-midts.vercel.app').replace(/\/+$/, '');
    var body = ['Partner Technical Assessment received.', '', 'Lead ID: ' + assessment.leadId, 'Partner: ' + assessment.reviewerOrganisation, 'Outcome: ' + assessment.feasibilityStatus, 'Pricing ready: ' + (pricingReady ? 'Yes' : 'No'), 'Assessment document: ' + assessment.partnerAssessmentDocumentLink, 'Workspace: ' + workspaceBase + '/workspace/vendor-request/review?leadId=' + encodeURIComponent(assessment.leadId)].join('\n');
    try {
      MailApp.sendEmail({ to: getIntakeEmail_(), name: 'MIDTS Backend', subject: subject, body: body });
      MidtsSheetService.appendEmailLog([new Date(), assessment.leadId, '', getIntakeEmail_(), '', subject, 'sent', 'Partner assessment received notification sent']);
      return { ok: true };
    } catch (error) {
      MidtsSheetService.appendEmailLog([new Date(), assessment.leadId, '', getIntakeEmail_(), '', subject, 'failed', errorMessage_(error)]);
      return { ok: false, message: errorMessage_(error) };
    }
  }

  function validateRequestToken_(requestId, rawToken, purpose) {
    if (!requestId || !rawToken) return { ok: false, message: 'This ' + purpose + ' link is incomplete.' };
    var request = findRequestById_(requestId);
    if (!request) return { ok: false, message: 'This ' + purpose + ' link is not recognised.' };
    if (hashToken_(rawToken) !== String(request.record['Request Token Hash'] || '')) return { ok: false, message: 'This ' + purpose + ' link is invalid.' };
    return { ok: true, record: request.record, request: request };
  }

  function validateVendorPricingRequest_(requestId, rawToken) {
    var request = validateRequestToken_(requestId, rawToken, 'pricing');
    if (!request.ok) return request;
    if (String(request.record['Request Status'] || '') !== 'Assessment Received') return { ok: false, message: 'Vendor pricing is blocked until a feasible partner assessment is received and marked pricing-ready.' };
    if (String(request.record['Pricing Readiness'] || '').toLowerCase() !== 'yes') return { ok: false, message: 'Partner assessment did not mark pricing readiness.' };
    var reviewResult = MidtsSheetService.findLatestTechnicalReviewByLeadId(request.record['Lead ID']);
    var reviewGuard = guardCompleteAssessment_(reviewResult && reviewResult.review || {});
    if (!reviewGuard.ok) return reviewGuard;
    return request;
  }

  function getSheet_() {
    var spreadsheetId = MidtsConfig.getSpreadsheetId();
    var spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('No spreadsheet is available for vendor requests.');
    var sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    ensureHeaders_(sheet);
    return sheet;
  }
  function ensureHeaders_(sheet) {
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) { sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]); sheet.setFrozenRows(1); return; }
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var existing = headers.reduce(function (map, header) { map[String(header || '').trim()] = true; return map; }, {});
    var missing = HEADERS.filter(function (header) { return !existing[header]; });
    if (missing.length) sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.setFrozenRows(1);
  }
  function headerMap_(sheet) { return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].reduce(function (map, header, index) { map[String(header || '').trim()] = index + 1; return map; }, {}); }
  function appendRequest_(request) { var sheet = getSheet_(); var map = headerMap_(sheet); var row = []; for (var i = 0; i < sheet.getLastColumn(); i += 1) row.push(''); HEADERS.forEach(function (header) { if (map[header]) row[map[header] - 1] = request[header] === undefined ? '' : request[header]; }); sheet.appendRow(row); }
  function findOpenRequestForLeadAndVendor_(leadId, vendorEmail) { var sheet = getSheet_(); var values = sheet.getDataRange().getValues(); if (values.length < 2) return null; var map = values[0].reduce(function (m, h, i) { m[String(h || '').trim()] = i + 1; return m; }, {}); for (var i = 1; i < values.length; i += 1) { var sameLead = String(values[i][map['Lead ID'] - 1]) === String(leadId); var sameVendor = String(values[i][map['Vendor Email'] - 1]).toLowerCase() === String(vendorEmail).toLowerCase(); var status = String(values[i][map['Request Status'] - 1]); if (sameLead && sameVendor && ['Pending Send', 'Sent', 'Assessment Received'].indexOf(status) !== -1) return true; } return false; }
  function findRequestById_(requestId) { var sheet = getSheet_(); var values = sheet.getDataRange().getValues(); if (values.length < 2) return null; var map = values[0].reduce(function (m, h, i) { m[String(h || '').trim()] = i + 1; return m; }, {}); for (var i = 1; i < values.length; i += 1) { if (String(values[i][map['Request ID'] - 1]) === String(requestId)) { var record = {}; Object.keys(map).forEach(function (header) { record[header] = values[i][map[header] - 1]; }); return { sheet: sheet, rowNumber: i + 1, headerMap: map, record: record }; } } return null; }
  function updateRequest_(result, updates) { if (!result) throw new Error('Vendor request not found.'); Object.keys(updates).forEach(function (header) { var column = result.headerMap[header]; if (!column) throw new Error('Vendor Requests column missing: ' + header); result.sheet.getRange(result.rowNumber, column).setValue(updates[header]); result.record[header] = updates[header]; }); }
  function buildPartnerAssessmentUrl_(requestId, rawToken) { return MidtsConfig.getWebAppUrl() + '?action=partnerAssessment&requestId=' + encodeURIComponent(requestId) + '&token=' + encodeURIComponent(rawToken); }
  function buildVendorPricingUrl_(requestId, rawToken) { var frontendUrl = MidtsConfig.getScriptProperty('VENDOR_PRICING_FORM_URL'); if (frontendUrl) return frontendUrl + (frontendUrl.indexOf('?') === -1 ? '?' : '&') + 'requestId=' + encodeURIComponent(requestId) + '&token=' + encodeURIComponent(rawToken); return MidtsConfig.getWebAppUrl() + '?action=vendorPricing&requestId=' + encodeURIComponent(requestId) + '&token=' + encodeURIComponent(rawToken); }
  function guardCompleteAssessment_(review) { var required = ['Technical Review ID', 'Reviewer', 'Reviewer Organisation', 'Reviewer Email', 'Files And Revisions Reviewed', 'Partner Review Package Link', 'Partner Assessment Document Link', 'Feasibility Status', 'Partner Submitted At', 'Review Summary', 'Recommendation']; var missing = required.filter(function (header) { return !String(review[header] || '').trim(); }); if (missing.length) return { ok: false, message: 'Partner Technical Assessment is incomplete: ' + missing.join(', ') + '.' }; var feasible = String(review['Feasibility Status'] || ''); if (feasible !== 'Feasible' && feasible !== 'Feasible with Assumptions') return { ok: false, message: 'Vendor pricing requires a Feasible partner assessment. Current outcome: ' + feasible + '.' }; return { ok: true }; }
  function recommendationForFeasibility_(value) { var status = String(value || '').trim(); if (status === 'Feasible' || status === 'Feasible with Assumptions') return 'Qualified'; if (status === 'Clarification Required' || status === 'Alternative Approach') return 'Needs More Info'; return 'Not Suitable'; }
  function hashToken_(value) { var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8); return bytes.map(function (byte) { var value = byte < 0 ? byte + 256 : byte; return ('0' + value.toString(16)).slice(-2); }).join(''); }
  function buildPricingNotes_(params) { return ['Vendor request: ' + String(params.requestId || ''), 'Vendor reference: ' + String(params.vendorReference || '').trim(), 'Lead time: ' + String(params.leadTime || '').trim(), 'Quote valid until: ' + String(params.quoteValidUntil || '').trim(), 'Exclusions or assumptions: ' + String(params.exclusions || '').trim(), 'Vendor notes: ' + String(params.notes || '').trim()].join('\n'); }
  function getIntakeEmail_() { return MidtsConfig.getScriptProperty('INTAKE_EMAIL') || 'midts.systems@gmail.com'; }
  function isInternalTokenValid_(token) { return token && String(token) === MidtsConfig.getDecisionToken(); }
  function isEmail_(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }
  function parseMoney_(value) { if (value === null || value === undefined || value === '') return null; var parsed = Number(String(value).replace(/,/g, '').trim()); return isFinite(parsed) ? parsed : null; }
  function field_(label, name, value, type, required, attributes) { return '<label>' + escapeHtml_(label) + '<input name="' + escapeHtml_(name) + '" type="' + escapeHtml_(type) + '" value="' + escapeHtml_(value) + '"' + (required ? ' required' : '') + (attributes ? ' ' + attributes : '') + '></label>'; }
  function textarea_(label, name, value, required) { return '<label>' + escapeHtml_(label) + '<textarea name="' + escapeHtml_(name) + '"' + (required ? ' required' : '') + '>' + escapeHtml_(value) + '</textarea></label>'; }
  function hiddenInput_(name, value) { return '<input type="hidden" name="' + escapeHtml_(name) + '" value="' + escapeHtml_(value) + '">'; }
  function htmlEmail_(leadId, lead, url) { return '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px"><p>The vendor-safe package is ready for <strong>' + escapeHtml_(leadId) + '</strong>.</p><p>Send the Partner Technical Assessment request before vendor pricing.</p><p><strong>Client:</strong> ' + escapeHtml_(lead['Full Name'] || '') + '<br><strong>Project:</strong> ' + escapeHtml_(lead['Project Type'] || '') + '</p><p><a href="' + escapeHtml_(url) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">Send partner assessment request</a></p></div>'; }
  function htmlPage_(title, body) { return HtmlService.createHtmlOutput(['<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">', '<title>' + escapeHtml_(title) + '</title><style>', 'body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif;line-height:1.5}.wrap{max-width:720px;margin:0 auto;padding:48px 24px}', 'h1{font-size:32px;line-height:1.1;margin:0 0 18px}.meta{font-size:12px;letter-spacing:.08em;margin:0 0 24px}.lede{font-size:17px;max-width:620px}', 'dl{border-top:1px solid #111;margin:32px 0}dt{font-size:12px;text-transform:uppercase;letter-spacing:.06em;padding-top:14px}dd{margin:2px 0 14px;font-size:16px}', 'form{border-top:1px solid #111;padding-top:24px;margin-top:28px}label{display:block;font-size:14px;margin:0 0 18px;font-weight:bold}input,textarea,select{box-sizing:border-box;display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #111;border-radius:0;background:#fff;color:#111;font:16px Arial,sans-serif;font-weight:normal}textarea{min-height:110px;resize:vertical}button,.package{display:inline-block;border:1px solid #111;background:#111;color:#fff;padding:12px 16px;font:14px Arial,sans-serif;text-decoration:none;cursor:pointer}.package{background:#fff;color:#111}.notice{border:1px solid #111;padding:12px;margin:18px 0;background:#f7f7f7}.check{display:flex;gap:10px;align-items:flex-start;border:1px solid #111;padding:12px;font-weight:normal}.check input{width:auto;margin:3px 0 0}', '@media(max-width:560px){.wrap{padding:32px 18px}h1{font-size:28px}}</style></head><body><main class="wrap">' + body + '</main></body></html>'].join('')); }
  function escapeHtml_(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;'); }
  function errorMessage_(error) { return String(error && error.message ? error.message : error); }
  function ensureVendorRequestSheet() { getSheet_(); return SHEET_NAME; }

  return { ensureVendorRequestSheet: ensureVendorRequestSheet, renderRequestSetup: renderRequestSetup, handleRequestSetupSubmission: handleRequestSetupSubmission, createAndSendRequest: createAndSendRequest, renderPartnerAssessmentForm: renderPartnerAssessmentForm, handlePartnerAssessmentSubmission: handlePartnerAssessmentSubmission, renderVendorPricingForm: renderVendorPricingForm, handleVendorPricingSubmission: handleVendorPricingSubmission, sendRequestSetupEmail: sendRequestSetupEmail, buildRequestSetupUrl: buildRequestSetupUrl };
})();
