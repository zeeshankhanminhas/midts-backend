var MidtsEmailService = (function () {
  var DEFAULT_INTAKE_EMAIL = 'intake@midts.com';

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

      logEmail(leadResult, lead.email, intakeEmail, subject, 'sent', 'Client acknowledgement sent');

      return {
        ok: true,
        status: 'sent',
        message: 'Client acknowledgement sent.'
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

    var subject = 'New MIDTS lead requires review - ' + leadId;
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

      logEmail(leadResult, intakeEmail, '', subject, 'sent', 'Internal review notification sent');

      return {
        ok: true,
        status: 'sent',
        message: 'Internal review notification sent.'
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
    var subject = 'Quote preparation required - ' + decisionResult.leadId;
    var lines = [
      'A MIDTS lead has been qualified and needs quote preparation.',
      '',
      'Lead ID: ' + decisionResult.leadId,
      'Quote Reference: ' + (decisionResult.updates['Quote Reference'] || ''),
      'Client: ' + lead.fullName,
      'Email: ' + lead.email,
      'Company: ' + lead.company,
      'Project Type: ' + lead.projectType,
      '',
      'Brief:',
      lead.briefRequirement || 'No brief supplied',
      '',
      'Next Action: Prepare quote'
    ];
    return {
      to: intakeEmail,
      internalCopyEmail: '',
      subject: subject,
      body: lines.join('\n'),
      htmlBody: paragraphHtml_(lines),
      logMessage: 'Qualified outcome email sent internally'
    };
  }

  function buildNeedsMoreInfoEmail_(decisionResult, lead, intakeEmail) {
    var subject = 'More information needed for your MIDTS enquiry - ' + decisionResult.leadId;
    var lines = [
      'Hello ' + lead.fullName + ',',
      '',
      'Thank you for your enquiry. We have reviewed the initial requirement and need a little more information before confirming the best next step.',
      '',
      'Please reply to this email with any additional drawings, files, dimensions, material details, deadlines, or background information that would help us assess the work properly.',
      '',
      'Reference: ' + decisionResult.leadId,
      '',
      'MIDTS',
      'intake@midts.com'
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
      'Thank you again for contacting MIDTS. We have reviewed your enquiry and will keep it on our follow-up list while the timing or requirement develops further.',
      '',
      'If anything changes, or if you have files or extra context to share, reply to this email and include the reference below.',
      '',
      'Reference: ' + decisionResult.leadId,
      '',
      'MIDTS',
      'intake@midts.com'
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
      'Thank you for contacting MIDTS. After reviewing the enquiry, we do not think we are the right fit for this requirement at this stage.',
      '',
      'We appreciate you getting in touch and wish you the best with the project.',
      '',
      'Reference: ' + decisionResult.leadId,
      '',
      'MIDTS',
      'intake@midts.com'
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
    return [
      'Hello ' + lead.fullName + ',',
      '',
      'Thank you for contacting MIDTS. We have received your enquiry and will review the technical requirement before confirming the next step.',
      '',
      'Reference: ' + leadId,
      'Project type: ' + (lead.projectType || 'Not specified'),
      '',
      'Summary received:',
      lead.briefRequirement || 'No brief supplied',
      '',
      'If you need to add information or files, reply to this email and include the reference above.',
      '',
      'MIDTS',
      'intake@midts.com'
    ].join('\n');
  }

  function buildHtmlBody(lead, leadId) {
    return paragraphHtml_([
      'Hello ' + lead.fullName + ',',
      '',
      'Thank you for contacting MIDTS. We have received your enquiry and will review the technical requirement before confirming the next step.',
      '',
      'Reference: ' + leadId,
      'Project type: ' + (lead.projectType || 'Not specified'),
      '',
      'Summary received:',
      lead.briefRequirement || 'No brief supplied',
      '',
      'If you need to add information or files, reply to this email and include the reference above.',
      '',
      'MIDTS',
      'intake@midts.com'
    ]);
  }

  function buildInternalPlainTextBody(leadResult) {
    var lead = leadResult.lead;
    return [
      'New MIDTS lead requires review.',
      '',
      'Lead ID: ' + leadResult.leadId,
      'Lifecycle Status: ' + (leadResult.lifecycleStatus || 'New Lead'),
      'Review Status: ' + (leadResult.reviewStatus || 'Pending Review'),
      'Next Action: ' + (leadResult.nextAction || 'Review lead'),
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
      '<h2 style="font-size:18px;margin:0 0 16px">New MIDTS lead requires review</h2>',
      '<p><strong>Lead ID:</strong> ' + escapeHtml(leadResult.leadId) + '<br>',
      '<strong>Lifecycle Status:</strong> ' + escapeHtml(leadResult.lifecycleStatus || 'New Lead') + '<br>',
      '<strong>Review Status:</strong> ' + escapeHtml(leadResult.reviewStatus || 'Pending Review') + '<br>',
      '<strong>Next Action:</strong> ' + escapeHtml(leadResult.nextAction || 'Review lead') + '</p>',
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

  function paragraphHtml_(lines) {
    var html = ['<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px">'];
    var paragraph = [];
    lines.forEach(function (line) {
      if (line === '') {
        if (paragraph.length) {
          html.push('<p>' + paragraph.map(escapeHtml).join('<br>') + '</p>');
          paragraph = [];
        }
      } else {
        paragraph.push(line);
      }
    });
    if (paragraph.length) {
      html.push('<p>' + paragraph.map(escapeHtml).join('<br>') + '</p>');
    }
    html.push('</div>');
    return html.join('');
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
    buildPlainTextBody: buildPlainTextBody,
    buildHtmlBody: buildHtmlBody
  };
})();
