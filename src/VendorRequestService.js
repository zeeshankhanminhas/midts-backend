var MidtsVendorRequestService = (function () {
  var SHEET_NAME = 'Vendor Requests';
  var HEADERS = [
    'Request ID',
    'Lead ID',
    'Technical Review ID',
    'Quote Reference',
    'Created At',
    'Sent At',
    'Vendor Name',
    'Vendor Email',
    'Vendor Package Link',
    'Reviewer Organisation',
    'Files And Revisions Priced',
    'Source Package ID',
    'Scope Revision',
    'Request Token Hash',
    'Request Status',
    'Submitted At',
    'Vendor Cost',
    'Vendor Currency',
    'Lead Time',
    'Quote Valid Until',
    'Exclusions',
    'Vendor Reference',
    'Vendor Notes',
    'Pricing ID',
    'Last Updated At'
  ];

  function renderRequestSetup(e) {
    var params = e && e.parameter || {};
    if (!isInternalTokenValid_(params.token) || !params.leadId) {
      return htmlPage_('Vendor request unavailable', '<p>This internal request link is invalid or incomplete.</p>');
    }

    var leadResult = MidtsSheetService.findLeadById(params.leadId);
    if (!leadResult) {
      return htmlPage_('Vendor request unavailable', '<p>The referenced lead could not be found.</p>');
    }

    if (String(leadResult.lead['Lifecycle Status'] || '') !== 'Vendor Pricing') {
      return htmlPage_('Vendor request unavailable', '<p>This lead is not ready for vendor pricing.</p>');
    }

    var lead = leadResult.lead;
    var packageResult = MidtsSheetService.findLatestVendorSafePackageByLeadId(params.leadId);
    var packageLink = packageResult && packageResult.vendorSafePackage && packageResult.vendorSafePackage['Drive Folder URL'] || '';
    var packageNotice = packageLink
      ? '<p class="notice">Vendor-safe package link has been prefilled from the latest package record.</p>'
      : '<p class="notice">No vendor-safe package link was found for this lead. Paste the approved Drive folder link before sending.</p>';
    var fileNotice = '<p class="notice"><strong>Before sending:</strong> upload only the approved vendor-safe files into the linked Drive folder. Do not send the request while the folder is empty or contains internal/client-confidential review material.</p>';
    var body = [
      '<p class="meta">MIDTS INTERNAL COMMERCIAL WORKFLOW</p>',
      '<h1>Send vendor pricing request</h1>',
      '<p class="lede">Select the vendor and provide the approved vendor-safe package link. MIDTS will send the vendor a one-time pricing response link.</p>',
      packageNotice,
      fileNotice,
      '<dl><dt>Lead</dt><dd>' + escapeHtml_(params.leadId) + '</dd>',
      '<dt>Client</dt><dd>' + escapeHtml_(lead['Full Name'] || '') + '</dd>',
      '<dt>Project</dt><dd>' + escapeHtml_(lead['Project Type'] || '') + '</dd></dl>',
      '<form method="post" action="' + escapeHtml_(MidtsConfig.getWebAppUrl()) + '">',
      hiddenInput_('action', 'vendorRequestSetup'),
      hiddenInput_('leadId', params.leadId),
      hiddenInput_('token', params.token),
      field_('Vendor name', 'vendorName', '', 'text', true),
      field_('Vendor email', 'vendorEmail', '', 'email', true),
      field_('Vendor-safe package link', 'packageLink', packageLink, 'url', true),
      '<label class="check"><input type="checkbox" name="vendorSafeFilesConfirmed" value="yes" required> I confirm the linked folder contains the approved vendor-safe files for this vendor request.</label>',
      '<button type="submit">Send pricing request</button>',
      '</form>'
    ].join('');
    return htmlPage_('Send vendor pricing request', body);
  }

  function handleRequestSetupSubmission(e) {
    try {
      var params = e && e.parameter || {};
      if (!isInternalTokenValid_(params.token)) {
        return htmlPage_('Vendor request failed', '<p>The internal action token is invalid.</p>');
      }

      var result = createAndSendRequest_(params);
      if (!result.ok) {
        return htmlPage_('Vendor request blocked', '<p>' + escapeHtml_(result.message) + '</p>');
      }

      return htmlPage_(
        'Vendor pricing request sent',
        '<p>The request was sent to ' + escapeHtml_(result.vendorEmail) + ' for lead ' + escapeHtml_(result.leadId) + '.</p>' +
        '<p>MIDTS will receive the margin-approval action email after the vendor submits their price.</p>'
      );
    } catch (error) {
      return htmlPage_('Vendor request failed', '<p>' + escapeHtml_(errorMessage_(error)) + '</p>');
    }
  }

  function createAndSendRequest(input) {
    return createAndSendRequest_(input || {});
  }

  function renderVendorPricingForm(e) {
    var params = e && e.parameter || {};
    var request = validateVendorRequest_(params.requestId, params.token);
    if (!request.ok) {
      return htmlPage_('Pricing request unavailable', '<p>' + escapeHtml_(request.message) + '</p>');
    }

    var leadResult = MidtsSheetService.findLeadById(request.record['Lead ID']);
    if (!leadResult) {
      return htmlPage_('Pricing request unavailable', '<p>The related MIDTS lead could not be found.</p>');
    }

    var lead = leadResult.lead;
    var body = [
      '<p class="meta">MIDTS VENDOR PRICING REQUEST</p>',
      '<h1>Submit your pricing</h1>',
      '<p class="lede">Please provide your commercial response for the vendor-safe package below.</p>',
      '<dl><dt>Reference</dt><dd>' + escapeHtml_(request.record['Quote Reference'] || request.record['Lead ID']) + '</dd>',
      '<dt>Project</dt><dd>' + escapeHtml_(lead['Project Type'] || '') + '</dd>',
      '<dt>Requirement</dt><dd>' + escapeHtml_(lead['Brief Requirement'] || '') + '</dd></dl>',
      '<p><a class="package" href="' + escapeHtml_(request.record['Vendor Package Link']) + '" target="_blank" rel="noopener">Open vendor-safe package</a></p>',
      '<form method="post" action="' + escapeHtml_(MidtsConfig.getWebAppUrl()) + '">',
      hiddenInput_('action', 'vendorPricing'),
      hiddenInput_('requestId', params.requestId),
      hiddenInput_('token', params.token),
      field_('Your quote reference', 'vendorReference', '', 'text', false),
      field_('Quoted cost', 'vendorCost', '', 'number', true, 'step="0.01" min="0"'),
      field_('Currency', 'vendorCurrency', 'GBP', 'text', true),
      field_('Lead time', 'leadTime', '', 'text', true),
      field_('Quote valid until', 'quoteValidUntil', '', 'date', true),
      textarea_('Exclusions or assumptions', 'exclusions', '', true),
      textarea_('Additional notes', 'notes', '', false),
      '<button type="submit">Submit pricing</button>',
      '</form>'
    ].join('');
    return htmlPage_('Submit vendor pricing', body);
  }

  function handleVendorPricingSubmission(e) {
    var lock = LockService.getScriptLock();
    var lockAcquired = false;
    try {
      lockAcquired = lock.tryLock(10000);
      if (!lockAcquired) {
        return htmlPage_('Pricing submission delayed', '<p>Please submit the form again in a moment.</p>');
      }
      var params = e && e.parameter || {};
      var request = validateVendorRequest_(params.requestId, params.token);
      if (!request.ok) {
        return htmlPage_('Pricing submission blocked', '<p>' + escapeHtml_(request.message) + '</p>');
      }

      var cost = parseMoney_(params.vendorCost);
      if (cost === null || cost < 0) {
        return htmlPage_('Pricing submission blocked', '<p>A valid quoted cost is required.</p>');
      }
      if (!String(params.leadTime || '').trim() || !String(params.quoteValidUntil || '').trim() || !String(params.exclusions || '').trim()) {
        return htmlPage_('Pricing submission blocked', '<p>Lead time, quote validity and exclusions or assumptions are required.</p>');
      }

      var pricing = MidtsVendorPricingService.recordVendorPricing({
        leadId: request.record['Lead ID'],
        vendorName: request.record['Vendor Name'],
        vendorEmail: request.record['Vendor Email'],
        vendorCost: cost,
        vendorCurrency: params.vendorCurrency || 'GBP',
        revisionReason: 'Vendor submission ' + request.record['Request ID'],
        notes: buildPricingNotes_(params)
      });
      if (!pricing.ok) {
        return htmlPage_('Pricing submission blocked', '<p>' + escapeHtml_(pricing.message || pricing.code) + '</p>');
      }

      updateRequest_(request, {
        'Request Status': 'Submitted',
        'Submitted At': new Date(),
        'Vendor Cost': cost,
        'Vendor Currency': params.vendorCurrency || 'GBP',
        'Lead Time': String(params.leadTime || '').trim(),
        'Quote Valid Until': String(params.quoteValidUntil || '').trim(),
        'Exclusions': String(params.exclusions || '').trim(),
        'Vendor Reference': String(params.vendorReference || '').trim(),
        'Vendor Notes': String(params.notes || '').trim(),
        'Pricing ID': pricing.pricingId,
        'Last Updated At': new Date()
      });

      MidtsEmailService.sendWorkflowActionEmailForLead(pricing.leadId);
      MidtsLogger.logWebhookAttempt({
        requestId: 'VENDOR-SUBMISSION-' + request.record['Request ID'],
        outcome: 'vendor_pricing_submitted',
        message: 'Vendor pricing received and moved to margin review',
        payload: { leadId: pricing.leadId, pricingId: pricing.pricingId, vendorRequestId: request.record['Request ID'] },
        submissionId: '',
        email: request.record['Vendor Email'],
        source: 'Vendor Request Service'
      });

      return htmlPage_(
        'Pricing submitted',
        '<p>Thank you. MIDTS has received your commercial response and will review it internally.</p>'
      );
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
    if (String(lead['Lifecycle Status'] || '') !== 'Vendor Pricing') {
      return { ok: false, message: 'Lead is not in Vendor Pricing.' };
    }

    var url = buildRequestSetupUrl(leadId);
    var subject = 'Send vendor pricing request - ' + leadId;
    var body = [
      'The vendor-safe package is ready. Select the vendor and send the pricing request.',
      'Before sending, upload only the approved vendor-safe files into the linked Drive folder. Do not send an empty folder.',
      '',
      'Lead ID: ' + leadId,
      'Client: ' + (lead['Full Name'] || ''),
      'Project: ' + (lead['Project Type'] || ''),
      '',
      'Send vendor pricing request: ' + url
    ].join('\n');

    try {
      MailApp.sendEmail({
        to: getIntakeEmail_(),
        name: 'MIDTS Backend',
        subject: subject,
        body: body,
        htmlBody: htmlEmail_(leadId, lead, url)
      });
      MidtsSheetService.appendEmailLog([new Date(), leadId, lead['Submission ID'] || '', getIntakeEmail_(), '', subject, 'sent', 'Vendor request setup email sent']);
      return { ok: true, status: 'sent', message: 'Vendor request setup email sent.' };
    } catch (error) {
      var message = errorMessage_(error);
      MidtsSheetService.appendEmailLog([new Date(), leadId, lead['Submission ID'] || '', getIntakeEmail_(), '', subject, 'failed', message]);
      return { ok: false, status: 'failed', message: message };
    }
  }

  function buildRequestSetupUrl(leadId) {
    return MidtsConfig.getWebAppUrl() + '?action=vendorRequestSetup&leadId=' +
      encodeURIComponent(leadId) + '&token=' + encodeURIComponent(MidtsConfig.getDecisionToken());
  }

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

      if (!leadId || !vendorName || !vendorEmail || !packageLink) {
        return { ok: false, message: 'Vendor name, email and vendor-safe package link are required.' };
      }
      if (!vendorSafeFilesConfirmed) return { ok: false, message: 'Confirm the vendor-safe folder contains the approved files before sending.' };
      if (!isEmail_(vendorEmail)) return { ok: false, message: 'Enter a valid vendor email address.' };
      if (!/^https:\/\//i.test(packageLink)) return { ok: false, message: 'Vendor-safe package link must use https://.' };

      var leadResult = MidtsSheetService.findLeadById(leadId);
      if (!leadResult) return { ok: false, message: 'Lead not found: ' + leadId };
      if (String(leadResult.lead['Lifecycle Status'] || '') !== 'Vendor Pricing') {
        return { ok: false, message: 'Lead is not in Vendor Pricing.' };
      }
      if (String(leadResult.lead['Lead Status'] || '') !== 'Qualified') {
        return { ok: false, message: 'Lead must be qualified before vendor pricing is requested.' };
      }
      if (findOpenRequestForLeadAndVendor_(leadId, vendorEmail)) {
        return { ok: false, message: 'An open vendor pricing request already exists for this vendor and lead.' };
      }

      var reviewResult = MidtsSheetService.findLatestTechnicalReviewByLeadId(leadId);
      var review = reviewResult && reviewResult.review || {};
      var reviewGuard = guardCompleteAssessment_(review);
      if (!reviewGuard.ok) return reviewGuard;

      var packageResult = MidtsSheetService.findLatestVendorSafePackageByLeadId(leadId);
      var vendorPackage = packageResult && packageResult.vendorSafePackage || {};
      var approvedPackageLink = String(vendorPackage['Drive Folder URL'] || '').trim();
      if (String(leadResult.lead['Vendor Safe Package Required'] || '').toLowerCase() === 'yes') {
        if (!approvedPackageLink || String(vendorPackage['Package Status'] || '') !== 'Approved for Vendor Pricing') {
          return { ok: false, message: 'Approved vendor-safe package is required before vendor pricing is requested.' };
        }
        if (packageLink !== approvedPackageLink) {
          return { ok: false, message: 'Vendor-safe package link must match the latest approved package record.' };
        }
      }

      var now = new Date();
      var requestId = 'VRQ-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
      var rawToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
      var tokenHash = hashToken_(rawToken);
      var request = {
        'Request ID': requestId,
        'Lead ID': leadId,
        'Technical Review ID': review['Technical Review ID'] || '',
        'Quote Reference': leadResult.lead['Quote Reference'] || '',
        'Created At': now,
        'Sent At': '',
        'Vendor Name': vendorName,
        'Vendor Email': vendorEmail,
        'Vendor Package Link': packageLink,
        'Reviewer Organisation': review['Reviewer Organisation'] || '',
        'Files And Revisions Priced': review['Files And Revisions Reviewed'] || '',
        'Source Package ID': vendorPackage['Package ID'] || '',
        'Scope Revision': vendorPackage['Package Hash'] || '',
        'Request Token Hash': tokenHash,
        'Request Status': 'Pending Send',
        'Submitted At': '',
        'Vendor Cost': '',
        'Vendor Currency': '',
        'Lead Time': '',
        'Quote Valid Until': '',
        'Exclusions': '',
        'Vendor Reference': '',
        'Vendor Notes': '',
        'Pricing ID': '',
        'Last Updated At': now
      };
      appendRequest_(request);

      var pricingUrl = buildVendorPricingUrl_(requestId, rawToken);
      var emailResult = sendVendorRequestEmail_(request, leadResult.lead, pricingUrl);
      var requestResult = findRequestById_(requestId);
      if (!emailResult.ok) {
        updateRequest_(requestResult, { 'Request Status': 'Send Failed', 'Last Updated At': new Date() });
        return { ok: false, message: 'Vendor request could not be emailed: ' + emailResult.message };
      }

      updateRequest_(requestResult, { 'Request Status': 'Sent', 'Sent At': new Date(), 'Last Updated At': new Date() });
      MidtsSheetService.updateLeadById(leadId, {
        'Next Action': 'Await vendor pricing',
        'Next Action Due': new Date(),
        'Vendor Pricing Status': 'Vendor Request Sent',
        'Last Updated At': new Date()
      });

      MidtsLogger.logWebhookAttempt({
        requestId: requestId,
        outcome: 'vendor_pricing_request_sent',
        message: 'Vendor pricing request sent',
        payload: {
          leadId: leadId,
          technicalReviewId: request['Technical Review ID'],
          sourcePackageId: request['Source Package ID'],
          vendorName: vendorName,
          vendorEmail: vendorEmail
        },
        submissionId: leadResult.lead['Submission ID'] || '',
        email: vendorEmail,
        source: 'Vendor Request Service'
      });
      return {
        ok: true,
        leadId: leadId,
        requestId: requestId,
        vendorEmail: vendorEmail,
        technicalReviewId: request['Technical Review ID'],
        sourcePackageId: request['Source Package ID']
      };
    } finally {
      if (lockAcquired) lock.releaseLock();
    }
  }

  function sendVendorRequestEmail_(request, lead, pricingUrl) {
    var subject = 'MIDTS pricing request - ' + (request['Quote Reference'] || request['Lead ID']);
    var body = [
      'Hello ' + request['Vendor Name'] + ',',
      '',
      'MIDTS invites you to submit commercial pricing for the vendor-safe package linked below.',
      '',
      'Package: ' + request['Vendor Package Link'],
      'Submit pricing: ' + pricingUrl,
      '',
      'Please include your quoted cost, lead time, quote validity, exclusions or assumptions, and any notes.',
      '',
      'MIDTS'
    ].join('\n');

    try {
      MailApp.sendEmail({
        to: request['Vendor Email'],
        replyTo: getIntakeEmail_(),
        name: 'MIDTS',
        subject: subject,
        body: body,
        htmlBody: [
          '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px">',
          '<p>Hello ' + escapeHtml_(request['Vendor Name']) + ',</p>',
          '<p>MIDTS invites you to submit commercial pricing for the vendor-safe package.</p>',
          '<p><a href="' + escapeHtml_(request['Vendor Package Link']) + '">Open vendor-safe package</a></p>',
          '<p><a href="' + escapeHtml_(pricingUrl) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">Submit pricing</a></p>',
          '<p>Please include your quoted cost, lead time, quote validity, exclusions or assumptions, and any notes.</p>',
          '<p>MIDTS</p></div>'
        ].join('')
      });
      MidtsSheetService.appendEmailLog([new Date(), request['Lead ID'], '', request['Vendor Email'], '', subject, 'sent', 'Vendor pricing request sent']);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: errorMessage_(error) };
    }
  }

  function validateVendorRequest_(requestId, rawToken) {
    if (!requestId || !rawToken) return { ok: false, message: 'This vendor pricing link is incomplete.' };
    var request = findRequestById_(requestId);
    if (!request) return { ok: false, message: 'This vendor pricing link is not recognised.' };
    if (hashToken_(rawToken) !== String(request.record['Request Token Hash'] || '')) {
      return { ok: false, message: 'This vendor pricing link is invalid.' };
    }
    if (String(request.record['Request Status'] || '') !== 'Sent') {
      return { ok: false, message: 'This pricing request has already been completed or is unavailable.' };
    }
    return { ok: true, record: request.record, request: request };
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
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
      return;
    }
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var existing = headers.reduce(function (map, header) { map[String(header || '').trim()] = true; return map; }, {});
    var missing = HEADERS.filter(function (header) { return !existing[header]; });
    if (missing.length) sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.setFrozenRows(1);
  }

  function appendRequest_(request) {
    var sheet = getSheet_();
    sheet.appendRow(HEADERS.map(function (header) { return request[header] === undefined ? '' : request[header]; }));
  }

  function findOpenRequestForLeadAndVendor_(leadId, vendorEmail) {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return null;
    var headerMap = values[0].reduce(function (map, header, index) { map[String(header || '').trim()] = index + 1; return map; }, {});
    for (var i = 1; i < values.length; i += 1) {
      var sameLead = String(values[i][headerMap['Lead ID'] - 1]) === String(leadId);
      var sameVendor = String(values[i][headerMap['Vendor Email'] - 1]).toLowerCase() === String(vendorEmail).toLowerCase();
      var status = String(values[i][headerMap['Request Status'] - 1]);
      if (sameLead && sameVendor && (status === 'Pending Send' || status === 'Sent')) return true;
    }
    return false;
  }

  function findRequestById_(requestId) {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return null;
    var headerMap = values[0].reduce(function (map, header, index) { map[String(header || '').trim()] = index + 1; return map; }, {});
    var idColumn = headerMap['Request ID'];
    for (var i = 1; i < values.length; i += 1) {
      if (String(values[i][idColumn - 1]) === String(requestId)) {
        var record = {};
        Object.keys(headerMap).forEach(function (header) { record[header] = values[i][headerMap[header] - 1]; });
        return { sheet: sheet, rowNumber: i + 1, headerMap: headerMap, record: record };
      }
    }
    return null;
  }

  function updateRequest_(result, updates) {
    if (!result) throw new Error('Vendor request not found.');
    Object.keys(updates).forEach(function (header) {
      var column = result.headerMap[header];
      if (!column) throw new Error('Vendor Requests column missing: ' + header);
      result.sheet.getRange(result.rowNumber, column).setValue(updates[header]);
    });
  }

  function buildVendorPricingUrl_(requestId, rawToken) {
    var frontendUrl = MidtsConfig.getScriptProperty('VENDOR_PRICING_FORM_URL');
    if (frontendUrl) {
      return frontendUrl + (frontendUrl.indexOf('?') === -1 ? '?' : '&') + 'requestId=' +
        encodeURIComponent(requestId) + '&token=' + encodeURIComponent(rawToken);
    }

    return MidtsConfig.getWebAppUrl() + '?action=vendorPricing&requestId=' +
      encodeURIComponent(requestId) + '&token=' + encodeURIComponent(rawToken);
  }

  function guardCompleteAssessment_(review) {
    var required = [
      'Technical Review ID',
      'Reviewer',
      'Reviewer Organisation',
      'Reviewer Email',
      'Files And Revisions Reviewed',
      'Partner Review Package Link',
      'Partner Assessment Document Link',
      'Feasibility Status',
      'Partner Submitted At',
      'Review Summary',
      'Recommendation'
    ];
    var missing = required.filter(function (header) { return !String(review[header] || '').trim(); });
    if (missing.length) return { ok: false, message: 'Partner technical assessment is incomplete: ' + missing.join(', ') + '.' };
    if (String(review['Recommendation'] || '') === 'Qualified' && String(review['Feasibility Status'] || '') !== 'Feasible') {
      return { ok: false, message: 'Qualified vendor pricing requires a Feasible partner assessment.' };
    }
    return { ok: true };
  }

  function hashToken_(value) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
    return bytes.map(function (byte) {
      var value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    }).join('');
  }

  function buildPricingNotes_(params) {
    return [
      'Vendor request: ' + String(params.requestId || ''),
      'Vendor reference: ' + String(params.vendorReference || '').trim(),
      'Lead time: ' + String(params.leadTime || '').trim(),
      'Quote valid until: ' + String(params.quoteValidUntil || '').trim(),
      'Exclusions or assumptions: ' + String(params.exclusions || '').trim(),
      'Vendor notes: ' + String(params.notes || '').trim()
    ].join('\n');
  }

  function getIntakeEmail_() {
    return MidtsConfig.getScriptProperty('INTAKE_EMAIL') || 'midts.systems@gmail.com';
  }

  function isInternalTokenValid_(token) {
    return token && String(token) === MidtsConfig.getDecisionToken();
  }

  function isEmail_(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
  }

  function parseMoney_(value) {
    if (value === null || value === undefined || value === '') return null;
    var parsed = Number(String(value).replace(/,/g, '').trim());
    return isFinite(parsed) ? parsed : null;
  }

  function field_(label, name, value, type, required, attributes) {
    return '<label>' + escapeHtml_(label) + '<input name="' + escapeHtml_(name) + '" type="' + escapeHtml_(type) +
      '" value="' + escapeHtml_(value) + '"' + (required ? ' required' : '') + (attributes ? ' ' + attributes : '') + '></label>';
  }

  function textarea_(label, name, value, required) {
    return '<label>' + escapeHtml_(label) + '<textarea name="' + escapeHtml_(name) + '"' + (required ? ' required' : '') + '>' +
      escapeHtml_(value) + '</textarea></label>';
  }

  function hiddenInput_(name, value) {
    return '<input type="hidden" name="' + escapeHtml_(name) + '" value="' + escapeHtml_(value) + '">';
  }

  function htmlEmail_(leadId, lead, url) {
    return '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px">' +
      '<p>The vendor-safe package is ready for <strong>' + escapeHtml_(leadId) + '</strong>.</p>' +
      '<p><strong>Before sending:</strong> upload only the approved vendor-safe files into the linked Drive folder. Do not send an empty folder or internal/client-confidential review material.</p>' +
      '<p><strong>Client:</strong> ' + escapeHtml_(lead['Full Name'] || '') + '<br>' +
      '<strong>Project:</strong> ' + escapeHtml_(lead['Project Type'] || '') + '</p>' +
      '<p><a href="' + escapeHtml_(url) + '" style="display:inline-block;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none">Send vendor pricing request</a></p></div>';
  }

  function htmlPage_(title, body) {
    return HtmlService.createHtmlOutput([
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>' + escapeHtml_(title) + '</title><style>',
      'body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif;line-height:1.5}.wrap{max-width:720px;margin:0 auto;padding:48px 24px}',
      'h1{font-size:32px;line-height:1.1;margin:0 0 18px}.meta{font-size:12px;letter-spacing:.08em;margin:0 0 24px}.lede{font-size:17px;max-width:620px}',
      'dl{border-top:1px solid #111;margin:32px 0}dt{font-size:12px;text-transform:uppercase;letter-spacing:.06em;padding-top:14px}dd{margin:2px 0 14px;font-size:16px}',
      'form{border-top:1px solid #111;padding-top:24px;margin-top:28px}label{display:block;font-size:14px;margin:0 0 18px;font-weight:bold}input,textarea{box-sizing:border-box;display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #111;border-radius:0;background:#fff;color:#111;font:16px Arial,sans-serif;font-weight:normal}textarea{min-height:110px;resize:vertical}button,.package{display:inline-block;border:1px solid #111;background:#111;color:#fff;padding:12px 16px;font:14px Arial,sans-serif;text-decoration:none;cursor:pointer}.package{background:#fff;color:#111}.notice{border:1px solid #111;padding:12px;margin:18px 0;background:#f7f7f7}.check{display:flex;gap:10px;align-items:flex-start;border:1px solid #111;padding:12px;font-weight:normal}.check input{width:auto;margin:3px 0 0}',
      '@media(max-width:560px){.wrap{padding:32px 18px}h1{font-size:28px}}</style></head><body><main class="wrap">' + body + '</main></body></html>'
    ].join(''));
  }

  function escapeHtml_(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function errorMessage_(error) {
    return String(error && error.message ? error.message : error);
  }

  function ensureVendorRequestSheet() {
    getSheet_();
    return SHEET_NAME;
  }

  return {
    ensureVendorRequestSheet: ensureVendorRequestSheet,
    renderRequestSetup: renderRequestSetup,
    handleRequestSetupSubmission: handleRequestSetupSubmission,
    createAndSendRequest: createAndSendRequest,
    renderVendorPricingForm: renderVendorPricingForm,
    handleVendorPricingSubmission: handleVendorPricingSubmission,
    sendRequestSetupEmail: sendRequestSetupEmail,
    buildRequestSetupUrl: buildRequestSetupUrl
  };
})();