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
    return [
      '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.55;max-width:640px">',
      '<p>Hello ' + escapeHtml(lead.fullName) + ',</p>',
      '<p>Thank you for contacting MIDTS. We have received your enquiry and will review the technical requirement before confirming the next step.</p>',
      '<p><strong>Reference:</strong> ' + escapeHtml(leadId) + '<br>',
      '<strong>Project type:</strong> ' + escapeHtml(lead.projectType || 'Not specified') + '</p>',
      '<p><strong>Summary received:</strong></p>',
      '<p>' + escapeHtml(lead.briefRequirement || 'No brief supplied').replace(/\n/g, '<br>') + '</p>',
      '<p>If you need to add information or files, reply to this email and include the reference above.</p>',
      '<p>MIDTS<br><a href="mailto:intake@midts.com">intake@midts.com</a></p>',
      '</div>'
    ].join('');
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
      'Human decision required: Qualified / Needs More Info / Nurture / Not Suitable'
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
      '<p><strong>Human decision required:</strong> Qualified / Needs More Info / Nurture / Not Suitable</p>',
      '</div>'
    ].join('');
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
    buildPlainTextBody: buildPlainTextBody,
    buildHtmlBody: buildHtmlBody
  };
})();
