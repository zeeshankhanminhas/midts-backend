var MidtsEmailService = (function () {
  var DEFAULT_INTAKE_EMAIL = 'midts.systems@gmail.com';

  function sendLeadAcknowledgement(leadResult) {
    var lead = leadResult && leadResult.lead;
    var leadId = leadResult && leadResult.leadId;

    if (!lead || !lead.email) {
      return { ok: false, status: 'skipped', message: 'No client email address supplied.' };
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
      return { ok: true, status: 'sent', message: 'Client acknowledgement and Step 2 request sent.' };
    } catch (error) {
      var message = String(error && error.message ? error.message : error);
      logEmail(leadResult, lead.email, intakeEmail, subject, 'failed', message);
      return { ok: false, status: 'failed', message: message };
    }
  }

  function sendInternalReviewNotification(leadResult) {
    logSkippedLegacyEmail_(leadResult, 'Internal Step 2 review notification disabled; Workspace Technical Review queue is source of truth.');
    return { ok: true, status: 'workspace_controlled_skipped', message: 'Workspace Technical Review queue controls this step.' };
  }

  function sendDecisionOutcomeEmail(decisionResult) {
    logSkippedLegacyEmail_({ leadId: decisionResult && decisionResult.leadId, lead: sheetLeadToEmailLead_(decisionResult && decisionResult.lead || {}) }, 'Decision outcome email disabled; Workspace controls qualification follow-up.');
    return { ok: true, status: 'workspace_controlled_skipped', message: 'Workspace controls qualification follow-up.' };
  }

  function sendWorkflowActionEmailForLead(leadId) {
    logSkippedLegacyEmail_({ leadId: leadId }, 'Workflow action email disabled; Workspace operational queues are source of truth.');
    return { ok: true, status: 'workspace_controlled_skipped', message: 'Workspace operational queues control workflow actions.' };
  }

  function logSkippedLegacyEmail_(leadResult, message) {
    try {
      MidtsSheetService.appendEmailLog([
        new Date(),
        leadResult && leadResult.leadId || '',
        leadResult && leadResult.submissionId || leadResult && leadResult.lead && leadResult.lead.submissionId || '',
        '',
        getIntakeEmail(),
        'Legacy Apps Script email disabled',
        'workspace_controlled_skipped',
        message
      ]);
    } catch (error) {}
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
    if (paragraph.length) html.push('<p>' + paragraph.map(linkifyAndEscape_).join('<br>') + '</p>');
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
