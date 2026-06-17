var MidtsLeadService = (function () {
  function firstPresent(payload, keys) {
    payload = payload || {};
    for (var i = 0; i < keys.length; i += 1) {
      var value = payload[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  function normalizePayload(payload) {
    payload = payload || {};
    return {
      submissionId: firstPresent(payload, ['submissionId', 'submission_id', 'lead_id', 'leadId']),
      fullName: firstPresent(payload, ['fullName', 'full_name', 'name', 'yourName']),
      email: firstPresent(payload, ['email', 'work_email', 'emailAddress', 'email_address']),
      company: firstPresent(payload, ['company', 'companyName', 'company_name']),
      projectType: firstPresent(payload, ['projectType', 'project_type', 'service', 'requirement']),
      briefRequirement: firstPresent(payload, ['briefRequirement', 'brief_requirement', 'notes', 'message', 'projectBrief']),
      source: firstPresent(payload, ['source']) || 'Website',
      pageUrl: firstPresent(payload, ['pageUrl', 'page_url', 'url']),
      rawPayload: payload
    };
  }

  function validateLead(lead) {
    var errors = [];
    if (!lead.fullName) errors.push('Full name is required.');
    if (!lead.email) errors.push('Email is required.');
    if (!lead.briefRequirement) errors.push('Brief requirement is required.');
    return errors;
  }

  function createLead(payload) {
    var lead = normalizePayload(payload);
    var errors = validateLead(lead);
    if (errors.length) {
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: errors.join(' '),
        lead: lead
      };
    }

    var leadId = createLeadId();
    var now = new Date();
    MidtsSheetService.appendLeadRow([
      leadId,
      now,
      lead.submissionId,
      lead.fullName,
      lead.email,
      lead.company,
      lead.projectType,
      lead.briefRequirement,
      lead.source,
      lead.pageUrl,
      'New',
      MidtsLogger.safeJson(lead.rawPayload),
      'New Lead',
      'Pending Review',
      '',
      '',
      '',
      '',
      '',
      'Review lead',
      nextBusinessDate_(1),
      'No',
      'No',
      '',
      getDocumentLink_('CAPABILITY_STATEMENT_URL'),
      'No',
      '',
      '',
      getDocumentLink_('QUOTE_TEMPLATE_URL'),
      '',
      '',
      '',
      '',
      0,
      '',
      '',
      '',
      '',
      '',
      '',
      now
    ]);

    return {
      ok: true,
      leadId: leadId,
      submissionId: lead.submissionId,
      lead: lead,
      lifecycleStatus: 'New Lead',
      reviewStatus: 'Pending Review',
      nextAction: 'Review lead'
    };
  }

  function createLeadId() {
    var timestamp = Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMddHHmmss');
    var suffix = Math.floor(Math.random() * 9000) + 1000;
    return 'MIDTS-' + timestamp + '-' + suffix;
  }

  function nextBusinessDate_(daysFromNow) {
    var date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  }

  function getDocumentLink_(propertyName) {
    return MidtsConfig.getScriptProperty(propertyName);
  }

  return {
    normalizePayload: normalizePayload,
    validateLead: validateLead,
    createLead: createLead
  };
})();
