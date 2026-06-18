var MidtsEmailService = (function () {
  var DEFAULT_INTAKE_EMAIL = 'midts.systems@gmail.com';

  function sendLeadAcknowledgement(leadResult) {
    var lead = leadResult && leadResult.lead;
    var leadId = leadResult && leadResult.leadId;

    if (!lead || !lead.email) {
      return {
        ok: false,
        status: 'skipped',
        message: 'No client email address supplied.'
      };
    }

    var subject = 'MIDTS enquiry received - ' + leadId;
    var body = buildPlainTextBody(lead, leadId);
    var htmlBody = buildHtmlBody(lead, leadId);
    var intakeEmail = getIntakeEmail();

    try {
      MailApp.sendEmail({
        to: lead.email,
        bcc: intakeEmail,
        replyTo: intakeEmail,
        name: 'MIDTS',
        subject: subject,
        body: body,
        htmlBody: htmlBody
      });

      logEmail(leadResult, lead.email, intakeEmail, subject, 'sent', 'Client acknowledgement and Step 2 request sent');

      return {
        ok: true,
        status: 'sent',
        message: 'Client acknowledgement and Step 2 request sent.'
      };
    } catch (error) {
      var message = String(error && error.message ? error.message : error);
      logEmail(leadResult, lead.email, intakeEmail, subject, 'failed', message);

      return {
        ok: false,
        status: 'failed',
        message: message
      };
    }
  }

  function sendInternalReviewNotification(leadResult) {
    var lead = leadResult && leadResult.lead;
    var leadId = leadResult && leadResult.leadId;
    var intakeEmail = getIntakeEmail();

    if (!lead || !leadId) {
      return {
        ok: false,
        status: 'skipped',
        message: 'No lead result supplied for internal review notification.'
      };
    }

    var subject = 'MIDTS Step 2 ready for review - ' + leadId;
    var body = buildInternalPlainTextBody(leadResult);
    var htmlBody = buildInternalHtmlBody(leadResult);

    try {
      MailApp.sendEmail({
        to: intakeEmail,
        replyTo: lead.email || intakeEmail,
        name: 'MIDTS Backend',
        subject: subject,
        body: body,
        htmlBody: htmlBody
      });

      logEmail(leadResult, intakeEmail, '', subject, 'sent', 'Internal review notification sent after Step 2');

      return {
        ok: true,
        status: 'sent',
        message: 'Internal review notification sent after Step 2.'
      };
    } catch (error) {
      var message = String(error && error.message ? error.message : error);
      logEmail(leadResult, intakeEmail, '', subject, 'failed', message);

      return {
        ok: false,
        status: 'failed',
        message: message
      };
    }
  }

  function sendDecisionOutcomeEmail(decisionResult) {
    var lead = sheetLeadToEmailLead_(decisionResult.lead || {});
    var leadResult = {
      leadId: decisionResult.leadId,
      submissionId: lead.submissionId,
      lead: lead
    };
    var intakeEmail = getIntakeEmail();
    var email = buildDecisionOutcomeEmail_(decisionResult, lead, intakeEmail);

    if (!email.to) {
      logEmail(leadResult, '', email.internalCopyEmail || '', email.subject, 'skipped', 'No recipient for outcome email');
      return { ok: false, status: 'skipped', message: 'No recipient for outcome email.' };
    }

    try {
      MailApp.sendEmail({
        to: email.to,
        bcc: email.bcc || '',
        replyTo: intakeEmail,
        name: 'MIDTS',
        subject: email.subject,
        body: email.body,
        htmlBody: email.htmlBody
      });

      logEmail(leadResult, email.to, email.internalCopyEmail || '', email.subject, 'sent', email.logMessage);
      return { ok: true, status: 'sent', message: email.logMessage };
    } catch (error) {
      var message = String(error && error.message ? error.message : error);
      logEmail(leadResult, email.to, email.internalCopyEmail || '', email.subject, 'failed', message);
      return { ok: false, status: 'failed', message: message };
    }
  }

  function sendWorkflowActionEmailForLead(leadId) {
    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) {
      return { ok: false, status: 'failed', message: 'Lead not found: ' + leadId };
    }

    var lead = sheetLeadToEmailLead_(leadResult.lead || {});
    var intakeEmail = getIntakeEmail();
    var email = buildWorkflowActionEmail_(leadId, leadResult.lead, lead, intakeEmail);
    var logLeadResult = {
      leadId: leadId,
      submissionId: lead.submissionId,
      lead: lead
    };

    try {
      MailApp.sendEmail({
        to: intakeEmail,
        replyTo: lead.email || intakeEmail,
        name: 'MIDTS Backend',
        subject: email.subject,
        body: email.body,
        htmlBody: email.htmlBody
      });

      logEmail(logLeadResult, intakeEmail, '', email.subject, 'sent', email.logMessage);
      return { ok: true, status: 'sent', message: email.logMessage };
    } catch (error) {
      var message = String(error && error.message ? error.message : error);
      logEmail(logLeadResult, intakeEmail, '', email.subject, 'failed', message);
      return { ok: false, status: 'failed', message: message };
    }
  }

  function buildDecisionOutcomeEmail_(decisionResult, lead, intakeEmail) {
    if (decisionResult.decision === 'qualified') {
      return buildQualifiedInternalEmail_(decisionResult, lead, intakeEmail);
    }
    if (decisionResult.decision === 'needs-more-info') {
      return buildNeedsMoreInfoEmail_(decisionResult, lead, intakeEmail);
    }
    if (decisionResult.decision === 'nurture') {
      return buildNurtureEmail_(decisionResult, lead, intakeEmail);
    }
    return buildNotSuitableEmail_(decisionResult, lead, intakeEmail);
  }

  function buildQualifiedInternalEmail_(decisionResult, lead, intakeEmail) {
    var updates = decisionResult.updates || {};
    var subject = 'Vendor pricing required - ' + decisionResult.leadId;
    var workflowLines = buildQualifiedWorkflowLines_(decisionResult.leadId, updates);
    var lines = [
      'A MIDTS lead has been qualified after Step 2 and now needs vendor pricing review.',
      '',
      'Lead ID: ' + decisionResult.leadId,
      'Quote Reference: ' + (updates['Quote Reference'] || ''),
      'Lifecycle Status: ' + (updates['Lifecycle Status'] || ''),
      'Quote Status: ' + (updates['Quote Status'] || ''),
      'Vendor Pricing Status: ' + (updates['Vendor Pricing Status'] || ''),
      'Client: ' + lead.fullName,
      'Email: ' + lead.email,
      'Company: ' + lead.company,
      'Project Type: ' + lead.projectType,
      '',
      'Brief:',
      lead.briefRequirement || 'No brief supplied',
      '',
      'Workflow action:',
    ].concat(workflowLines);
    return {
      to: intakeEmail,
      internalCopyEmail: '',
      subject: subject,
      body: lines.join('\n'),
      htmlBody: paragraphHtml_(lines),
      logMessage: 'Qualified vendor pricing email sent internally'
    };
  }

  function buildQualifiedWorkflowLines_(leadId, updates) {
    if (String(updates['Vendor Pricing Status'] || '') === 'Vendor Safe Package Required') {
      return [
        'Mark Vendor Safe Ready: ' + MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.VENDOR_SAFE_READY),
        'Use this after the vendor-safe package is ready. The lead will move to Vendor Pricing.'
      ];
    }

    return [
      'No approval click is needed yet.',
      'Record vendor pricing first. After pricing is recorded, the system can send the margin approval action link.'
    ];
  }

  function buildWorkflowActionEmail_(leadId, sheetLead, lead, intakeEmail) {
    var subject = 'MIDTS workflow action - ' + leadId;
    var actionLines = getWorkflowActionLines_(leadId, sheetLead);
    var lines = [
      'MIDTS workflow action for current lead stage.',
      '',
      'Lead ID: ' + leadId,
      'Quote Reference: ' + (sheetLead['Quote Reference'] || ''),
      'Lifecycle Status: ' + (sheetLead['Lifecycle Status'] || ''),
      'Quote Status: ' + (sheetLead['Quote Status'] || ''),
      'Vendor Pricing Status: ' + (sheetLead['Vendor Pricing Status'] || ''),
      'Client: ' + lead.fullName,
      'Email: ' + lead.email,
      'Company: ' + lead.company,
      '',
      'Available action:',
    ].concat(actionLines);

    return {
      subject: subject,
      body: lines.join('\n'),
      htmlBody: paragraphHtml_(lines),
      logMessage: 'Workflow action email sent internally'
    };
  }

  function getWorkflowActionLines_(leadId, sheetLead) {
    var lifecycleStatus = String(sheetLead['Lifecycle Status'] || '');
    var quoteStatus = String(sheetLead['Quote Status'] || '');
    var vendorPricingStatus = String(sheetLead['Vendor Pricing Status'] || '');
    var vendorSafeRequired = String(sheetLead['Vendor Safe Package Required'] || '').toLowerCase() === 'yes';
    var vendorSafeReady = String(sheetLead['Vendor Safe Package Ready'] || '').toLowerCase() === 'yes';

    if (vendorSafeRequired && !vendorSafeReady && quoteStatus === 'Waiting Vendor Safe Package') {
      return [
        'Mark Vendor Safe Ready: ' + MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.VENDOR_SAFE_READY)
      ];
    }

    if (lifecycleStatus === 'Margin Review' || quoteStatus === 'Margin Review Required' || vendorPricingStatus === 'Pricing Received') {
      return [
        'Approve Margin: ' + MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.APPROVE_MARGIN)
      ];
    }

    if (lifecycleStatus === 'Quote Preparation' || quoteStatus === 'Ready for Quote Draft') {
      return [
        'Prepare Quote: ' + MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.PREPARE_QUOTE)
      ];
    }

    if (lifecycleStatus === 'Quote Draft' || quoteStatus === 'Draft Prepared') {
      return [
        'Approve Quote: ' + MidtsWorkflowActionService.buildActionUrl(leadId, MidtsWorkflowActionService.ACTIONS.APPROVE_QUOTE)
      ];
    }

    if (lifecycleStatus === 'Vendor Pricing' || quoteStatus === 'Waiting Vendor Price') {
      return [
        'No approval click is available at this stage.',
        'Record vendor pricing first. The next action after pricing is margin approval.'
      ];
    }

    return [
      'No workflow action is available for this stage. Review the lead status before proceeding.'
    ];
  }

  function buildNeedsMoreInfoEmail_(decisionResult, lead, intakeEmail) {
    var subject = 'More information needed for your MIDTS enquiry - ' + decisionResult.leadId;
    var lines = [
      'Hello ' + lead.fullName + ',',
      '',
      'Thank you for completing the technical requirement. We have reviewed the information and need a little more detail before confirming the best next step.',
      '',
      'Please reply to this email with any additional drawings, files, dimensions, material details, deadlines, or background information that would help us assess the work properly.',
      '',
      'Reference: ' + decisionResult.leadId,
      '',
      'MIDTS',
      intakeEmail
    ];
    return {
      to: lead.email,
      bcc: intakeEmail,
      internalCopyEmail: intakeEmail,
      subject: subject,
      body: lines.join('\n'),
      htmlBody: paragraphHtml_(lines),
      logMessage: 'Needs More Info client email sent'
    };
  }

  function buildNurtureEmail_(decisionResult, lead, intakeEmail) {
    var subject = 'MIDTS enquiry follow-up - ' + decisionResult.leadId;
    var lines = [
      'Hello ' + lead.fullName + ',',
      '',
      'Thank you again for contacting MIDTS and sharing the technical requirement. We have reviewed it and will keep it on our follow-up list while the timing or requirement develops further.',
      '',
      'If anything changes, or if you have files or extra context to share, reply to this email and include the reference below.',
      '',
      'Reference: ' + decisionResult.leadId,
      '',
      'MIDTS',
      intakeEmail
    ];
    return {
      to: lead.email,
      bcc: intakeEmail,
      internalCopyEmail: intakeEmail,
      subject: subject,
      body: lines.join('\n'),
      htmlBody: paragraphHtml_(lines),
      logMessage: 'Nurture client email sent'
    };
  }

  function buildNotSuitableEmail_(decisionResult, lead, intakeEmail) {
    var subject = 'MIDTS enquiry update - ' + decisionResult.leadId;
    var lines = [
      'Hello ' + lead.fullName + ',',
      '',
      'Thank you for completing the technical requirement. After reviewing the enquiry, we do not think we are the right fit for this requirement at this stage.',
      '',
      'We appreciate you getting in touch and wish you the best with the project.',
      '',
      'Reference: ' + decisionResult.leadId,
      '',
      'MIDTS',
      intakeEmail
    ];
    return {
      to: lead.email,
      bcc: intakeEmail,
      internalCopyEmail: intakeEmail,
      subject: subject,
      body: lines.join('\n'),
      htmlBody: paragraphHtml_(lines),
      logMessage: 'Not Suitable client email sent'
    };
  }

  function logEmail(leadResult, recipientEmail, internalCopyEmail, subject, status, message) {
    var lead = leadResult && leadResult.lead;
    MidtsSheetService.appendEmailLog([
      new Date(),
      leadResult && leadResult.leadId || '',
      lead && lead.submissionId || leadResult && leadResult.submissionId || '',
      recipientEmail || '',
      internalCopyEmail || '',
      subject || '',
      status || '',
      message || ''
    ]);
  }

  function getIntakeEmail() {
    var configured = MidtsConfig.getScriptProperty('INTAKE_EMAIL');
    return configured || DEFAULT_INTAKE_EMAIL;
  }

  function buildPlainTextBody(lead, leadId) {
    var step2Url = buildStep2Url_(leadId, lead.submissionId);
    var intakeEmail = getIntakeEmail();
    return [
      'Hello ' + lead.fullName + ',',
      '',
      'Thank you for contacting MIDTS. We have received your initial enquiry.',
      '',
      'Reference: ' + leadId,
      'Project type: ' + (lead.projectType || 'Not specified'),
      '',
      'Before we can review the requirement commercially, please complete the technical requirement step.',
      step2Url ? 'Step 2 link: ' + step2Url : 'If you do not have the Step 2 link, reply to this email and we will help you complete the technical requirement.',
      '',
      'MIDTS',
      intakeEmail
    ].join('\n');
  }

  function buildHtmlBody(lead, leadId) {
    var step2Url = buildStep2Url_(leadId, lead.submissionId);
    var intakeEmail = getIntakeEmail();
    var lines = [
      'Hello ' + lead.fullName + ',',
      '',
      'Thank you for contacting MIDTS. We have received your initial enquiry.',
      '',
      'Reference: ' + leadId,
      'Project type: ' + (lead.projectType || 'Not specified'),
      '',
      'Before we can review the requirement commercially, please complete the technical requirement step.',
      step2Url ? 'Step 2 link: ' + step2Url : 'If you do not have the Step 2 link, reply to this email and we will help you complete the technical requirement.',
      '',
      'MIDTS',
      intakeEmail
    ];
    return paragraphHtml_(lines);
  }

  function buildInternalPlainTextBody(leadResult) {
    var lead = leadResult.lead;
    return [
      'MIDTS Step 2 is complete and requires review.',
      '',
      'Lead ID: ' + leadResult.leadId,
      'Lifecycle Status: ' + (leadResult.lifecycleStatus || 'Pending Review'),
      'Review Status: ' + (leadResult.reviewStatus || 'Pending Review'),
      'Next Action: ' + (leadResult.nextAction || 'Review technical requirement'),
      '',
      'Client: ' + (lead.fullName || ''),
      'Email: ' + (lead.email || ''),
      'Company: ' + (lead.company || ''),
      'Project Type: ' + (lead.projectType || ''),
      '',
      'Brief:',
      lead.briefRequirement || 'No brief supplied',
      '',
      'Decision links:',
      'Qualified: ' + MidtsDecisionService.buildDecisionUrl(leadResult.leadId, 'qualified'),
      'Needs More Info: ' + MidtsDecisionService.buildDecisionUrl(leadResult.leadId, 'needs-more-info'),
      'Nurture: ' + MidtsDecisionService.buildDecisionUrl(leadResult.leadId, 'nurture'),
      'Not Suitable: ' + MidtsDecisionService.buildDecisionUrl(leadResult.leadId, 'not-suitable')
    ].join('\n');
  }

  function buildInternalHtmlBody(leadResult) {
    var lead = leadResult.lead;
    return [
      '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:720px">',
      '<h2 style="font-size:18px;margin:0 0 16px">MIDTS Step 2 ready for review</h2>',
      '<p><strong>Lead ID:</strong> ' + escapeHtml(leadResult.leadId) + '<br>',
      '<strong>Lifecycle Status:</strong> ' + escapeHtml(leadResult.lifecycleStatus || 'Pending Review') + '<br>',
      '<strong>Review Status:</strong> ' + escapeHtml(leadResult.reviewStatus || 'Pending Review') + '<br>',
      '<strong>Next Action:</strong> ' + escapeHtml(leadResult.nextAction || 'Review technical requirement') + '</p>',
      '<p><strong>Client:</strong> ' + escapeHtml(lead.fullName || '') + '<br>',
      '<strong>Email:</strong> ' + escapeHtml(lead.email || '') + '<br>',
      '<strong>Company:</strong> ' + escapeHtml(lead.company || '') + '<br>',
      '<strong>Project Type:</strong> ' + escapeHtml(lead.projectType || '') + '</p>',
      '<p><strong>Brief:</strong></p>',
      '<p>' + escapeHtml(lead.briefRequirement || 'No brief supplied').replace(/\n/g, '<br>') + '</p>',
      '<p><strong>Choose the review decision:</strong></p>',
      '<p>' + decisionButton_(leadResult.leadId, 'qualified', 'Qualified') + ' ' + decisionButton_(leadResult.leadId, 'needs-more-info', 'Needs More Info') + '</p>',
      '<p>' + decisionButton_(leadResult.leadId, 'nurture', 'Nurture') + ' ' + decisionButton_(leadResult.leadId, 'not-suitable', 'Not Suitable') + '</p>',
      '</div>'
    ].join('');
  }

  function decisionButton_(leadId, decisionKey, label) {
    var url = MidtsDecisionService.buildDecisionUrl(leadId, decisionKey);
    return '<a href="' + escapeHtml(url) + '" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 14px;border:1px solid #111;color:#111;text-decoration:none;font-size:14px">' + escapeHtml(label) + '</a>';
  }

  function sheetLeadToEmailLead_(sheetLead) {
    return {
      submissionId: sheetLead['Submission ID'] || '',
      fullName: sheetLead['Full Name'] || 'there',
      email: sheetLead['Email'] || '',
      company: sheetLead['Company'] || '',
      projectType: sheetLead['Project Type'] || '',
      briefRequirement: sheetLead['Brief Requirement'] || '',
      source: sheetLead['Source'] || ''
    };
  }

  function buildStep2Url_(leadId, submissionId) {
    var baseUrl = MidtsConfig.getScriptProperty('STEP2_FORM_URL') || MidtsConfig.getScriptProperty('STEP2_FORM_BASE_URL');
    if (!baseUrl) return '';
    var separator = baseUrl.indexOf('?') === -1 ? '?' : '&';
    return baseUrl + separator + 'leadId=' + encodeURIComponent(leadId || '') + '&submissionId=' + encodeURIComponent(submissionId || '');
  }

  function paragraphHtml_(lines) {
    var html = ['<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px">'];
    var paragraph = [];
    lines.forEach(function (line) {
      if (line === '') {
        if (paragraph.length) {
          html.push('<p>' + paragraph.map(linkifyAndEscape_).join('<br>') + '</p>');
          paragraph = [];
        }
      } else {
        paragraph.push(line);
      }
    });
    if (paragraph.length) {
      html.push('<p>' + paragraph.map(linkifyAndEscape_).join('<br>') + '</p>');
    }
    html.push('</div>');
    return html.join('');
  }

  function linkifyAndEscape_(value) {
    var text = String(value || '');
    var labeledUrl = text.match(/^([^:\n]{1,90}):\s*(https?:\/\/\S+)$/);
    if (labeledUrl) {
      return escapeHtml(labeledUrl[1]) + ': <a href="' + escapeHtml(labeledUrl[2]) + '">' + escapeHtml(labeledUrl[2]) + '</a>';
    }
    return escapeHtml(text);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    sendLeadAcknowledgement: sendLeadAcknowledgement,
    sendInternalReviewNotification: sendInternalReviewNotification,
    sendDecisionOutcomeEmail: sendDecisionOutcomeEmail,
    sendWorkflowActionEmailForLead: sendWorkflowActionEmailForLead,
    buildPlainTextBody: buildPlainTextBody,
    buildHtmlBody: buildHtmlBody
  };
})();
