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

      MidtsSheetService.appendEmailLog([
        new Date(),
        leadId,
        lead.submissionId || '',
        lead.email,
        intakeEmail,
        subject,
        'sent',
        'Client acknowledgement sent'
      ]);

      return {
        ok: true,
        status: 'sent',
        message: 'Client acknowledgement sent.'
      };
    } catch (error) {
      var message = String(error && error.message ? error.message : error);
      MidtsSheetService.appendEmailLog([
        new Date(),
        leadId,
        lead.submissionId || '',
        lead.email,
        intakeEmail,
        subject,
        'failed',
        message
      ]);

      return {
        ok: false,
        status: 'failed',
        message: message
      };
    }
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
    buildPlainTextBody: buildPlainTextBody,
    buildHtmlBody: buildHtmlBody
  };
})();
