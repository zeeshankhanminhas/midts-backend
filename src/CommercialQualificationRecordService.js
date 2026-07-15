var MidtsCommercialQualificationRecordService = (function () {
  var AWAITING = 'Awaiting Confirmation';
  var NOT_APPLICABLE = 'Not Applicable';

  function getCommercialQualificationRecord(input) {
    input = input || {};
    var leadId = clean_(input.leadId || input.lead_id);
    if (!leadId) {
      return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required to read the Commercial Qualification Record.' };
    }

    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    }

    var intakeResult = MidtsSheetService.findLatestTechnicalIntakeByLeadId(leadId);
    var reviewResult = MidtsSheetService.findLatestTechnicalReviewByLeadId(leadId);
    var document = toCommercialQualificationRecordData_(
      leadResult.lead,
      intakeResult ? intakeResult.intake : {},
      reviewResult ? reviewResult.review : {},
      { status: input.status || 'Draft' }
    );

    return {
      ok: true,
      leadId: leadId,
      documentType: 'commercialQualificationRecord',
      liveBacked: true,
      issueBlocked: Boolean(document.issueBlocked),
      missingRequiredFields: document.missingRequiredFields || [],
      document: document
    };
  }

  function toCommercialQualificationRecordData_(lead, intake, review, options) {
    lead = lead || {};
    intake = intake || {};
    review = review || {};
    options = options || {};

    var leadId = clean_(lead['Lead ID']);
    var technicalIntakeId = clean_(intake['Technical Intake ID']);
    var documentReference = 'MIDTS-CQR-' + (leadId || 'AWAITING');
    var projectReference = leadId || 'MIDTS-PRJ-AWAITING';
    var issueDate = dateOnly_(lead['Decision Timestamp'] || lead['Last Updated At'] || new Date());
    var decision = valueOrState_(lead['Qualification Decision']);
    var missing = missingRequiredFields_(lead, intake);
    var issueBlocked = missing.length > 0 || decision === AWAITING;
    var documentStatus = issueBlocked ? 'Draft' : 'Under Review';
    var filesState = fileState_(lead, intake);
    var reviewSummary = clean_(review['Review Summary']);
    var partner = clean_(review['Reviewer Organisation']);

    return {
      documentType: 'commercialQualificationRecord',
      status: String(options.status || documentStatus).toLowerCase().replace(/\s+/g, '-'),
      title: 'Commercial Qualification Record',
      reference: documentReference,
      revision: 'A',
      issueDate: issueDate,
      projectReference: projectReference,
      preparedBy: clean_(lead['Reviewer']) || 'MIDTS Commercial Control',
      reviewedBy: clean_(lead['Reviewer']) || AWAITING,
      approvedBy: decision === AWAITING ? AWAITING : clean_(lead['Reviewer']) || 'MIDTS Commercial Control',
      owner: 'MIDTS Commercial Control',
      audience: 'MIDTS internal commercial and operations team',
      confidentiality: 'Internal',
      purposeOfIssue: 'Internal',
      liveBacked: true,
      issueBlocked: issueBlocked,
      missingRequiredFields: missing,
      coverMessage: 'Controlled internal record of MIDTS commercial qualification, assembled from live Lead, Technical Intake, and Partner Technical Assessment records. It supports the decision to proceed, request information, nurture, or decline before vendor-safe package preparation.',
      metadata: [
        field_('Document Title', 'Commercial Qualification Record'),
        field_('Document Reference', documentReference),
        field_('Project Reference', projectReference),
        field_('Lead Reference', leadId || AWAITING),
        field_('Technical Intake Reference', technicalIntakeId || AWAITING),
        field_('Revision', 'A'),
        field_('Workflow Stage', valueOrState_(lead['Lifecycle Status'] || 'Commercial Qualification')),
        field_('Document Status', documentStatus),
        field_('Document Purpose', 'Internal'),
        field_('Prepared By', clean_(lead['Reviewer']) || 'MIDTS Commercial Control'),
        field_('Reviewed By', clean_(lead['Reviewer']) || AWAITING),
        field_('Approved By', decision === AWAITING ? AWAITING : clean_(lead['Reviewer']) || 'MIDTS Commercial Control'),
        field_('Issue Date', issueDate),
        field_('Confidentiality Classification', 'Internal'),
        field_('Partner', partner || NOT_APPLICABLE),
        field_('Client', valueOrState_(lead['Full Name'])),
        field_('Company', valueOrState_(lead['Company'])),
        field_('Project', valueOrState_(lead['Project Type'] || lead['Brief Requirement']))
      ],
      sections: [
        fieldsSection_('Executive Summary', 'Commercial qualification summary', [
          field_('Enquiry summary', valueOrState_(lead['Brief Requirement'] || intake['Technical Scope'])),
          field_('Client requirement summary', valueOrState_(intake['Technical Scope'] || lead['Brief Requirement'])),
          field_('Opportunity overview', valueOrState_(lead['Project Type'])),
          field_('Current workflow position', valueOrState_(lead['Lifecycle Status'] || 'Commercial Qualification')),
          field_('Business decision supported', 'Proceed to Vendor Safe Package, request more information, nurture, or mark not suitable.')
        ]),
        fieldsSection_('Client Information', 'Client and enquiry record', [
          field_('Client', valueOrState_(lead['Full Name'])),
          field_('Company', valueOrState_(lead['Company'])),
          field_('Contact', valueOrState_(lead['Email'])),
          field_('Enquiry source', valueOrState_(lead['Source'] || 'Website lead capture')),
          field_('Enquiry date', dateOnly_(lead['Created At']) || AWAITING),
          field_('Project type', valueOrState_(lead['Project Type'] || intake['Service Type'])),
          field_('Project', valueOrState_(lead['Brief Requirement'] || intake['Technical Scope']))
        ]),
        tableSection_('Commercial Assessment', 'Commercial assessment matrix', ['Assessment Item', 'Current Position', 'Commercial Meaning', 'Status'], [
          ['Commercial fit', decision === AWAITING ? 'Awaiting qualification decision.' : decision, 'MIDTS commercial route decision only; engineering feasibility remains partner-owned.', statusFromValue_(decision)],
          ['Opportunity type', valueOrState_(lead['Project Type'] || intake['Service Type']), 'MIDTS acts as commercial and coordination interface.', statusFromValue_(lead['Project Type'] || intake['Service Type'])],
          ['Urgency', valueOrState_(intake['Deadline'] || intake['Timing Notes']), 'Timeline may affect partner availability, pricing, and quote validity.', statusFromValue_(intake['Deadline'] || intake['Timing Notes'])],
          ['Estimated value', valueOrState_(intake['Budget Range']), 'Used for commercial prioritisation only, not client pricing approval.', statusFromValue_(intake['Budget Range'])],
          ['NDA required', valueOrState_(lead['NDA Required'] || intake['NDA Required']), 'Controls vendor-safe package handling and file release.', statusFromValue_(lead['NDA Required'] || intake['NDA Required'])],
          ['Files received', filesState.value, 'Required for partner assessment readiness.', filesState.status],
          ['Technical intake complete', technicalIntakeId ? 'Yes' : AWAITING, 'Must be complete before vendor-safe package preparation.', technicalIntakeId ? 'Confirmed' : AWAITING],
          ['Selected engineering partner', partner || NOT_APPLICABLE, 'Partner is selected after commercial qualification and package readiness.', partner ? 'Recorded' : NOT_APPLICABLE],
          ['Commercial observations', valueOrState_(lead['Review Notes'] || reviewSummary), 'Record non-standard risks, constraints, or launch pricing considerations.', statusFromValue_(lead['Review Notes'] || reviewSummary)]
        ]),
        tableSection_('Qualification Checklist', 'Controlled readiness checklist', ['Checklist Item', 'Requirement', 'Status', 'Evidence'], [
          ['Client identified', 'Client name and company are known.', statusFromValue_(lead['Full Name'] || lead['Company']), 'Lead record'],
          ['Contact details verified', 'Email or phone is sufficient for controlled follow-up.', statusFromValue_(lead['Email']), 'Lead record'],
          ['Files received', 'Relevant files are uploaded or confirmed as unavailable.', filesState.status, 'Technical intake / Drive record'],
          ['NDA reviewed', 'Confidentiality requirement is understood.', statusFromValue_(lead['NDA Required'] || intake['NDA Required']), 'Lead and intake records'],
          ['Requirement understood commercially', 'Commercial scope is understandable enough to proceed.', statusFromValue_(lead['Brief Requirement'] || intake['Technical Scope']), 'Step 1 and Step 2 records'],
          ['Suitable partner identified', 'Candidate engineering partner can assess the package.', partner ? 'Recorded' : NOT_APPLICABLE, 'Partner selection / review record'],
          ['Commercial risk acceptable', 'Commercial risks are manageable or have owner actions.', decision === AWAITING ? 'Under Review' : 'Recorded', 'Qualification decision'],
          ['Ready for Vendor Safe Package', 'All minimum commercial controls are complete.', issueBlocked ? 'Blocked' : 'Ready', 'Qualification decision']
        ]),
        tableSection_('Partner Selection', 'Partner selection basis', ['Partner', 'Reason Selected', 'Capability', 'Availability', 'Status'], [
          [partner || NOT_APPLICABLE, partner ? 'Recorded from Partner Technical Assessment.' : 'Partner not selected during commercial qualification.', valueOrState_(review['Recommendation'] || lead['Project Type']), AWAITING, partner ? 'Recorded' : NOT_APPLICABLE]
        ]),
        tableSection_('Commercial Risks', 'Commercial risk register', ['Risk', 'Impact', 'Likelihood', 'Mitigation', 'Owner', 'Status'], riskRows_(lead, intake, review)),
        tableSection_('Missing Information', 'Missing information register', ['Item', 'Reason Required', 'Impact', 'Owner', 'Status', 'Due Date'], missingRows_(lead, intake, missing)),
        fieldsSection_('Qualification Decision', 'Decision and rationale', [
          field_('Qualification decision', decision),
          field_('Allowed values', 'Qualified / Information Required / Nurture / Not Suitable'),
          field_('Decision rationale', valueOrState_(lead['Review Notes'] || lead['Missing Information Needed'] || reviewSummary)),
          field_('Decision owner', clean_(lead['Reviewer']) || 'MIDTS Commercial Control'),
          field_('Decision date', dateOnly_(lead['Decision Timestamp']) || AWAITING)
        ]),
        tableSection_('Next Action', 'Controlled next action', ['Owner', 'Due Date', 'Expected Outcome'], [
          ['MIDTS Commercial Control', dateOnly_(lead['Next Action Due']) || AWAITING, valueOrState_(lead['Next Action'])],
          ['MIDTS Operations', AWAITING, issueBlocked ? 'Resolve blocked fields before final issue/render.' : 'Proceed using controlled next lifecycle action.']
        ]),
        statementSection_('Engineering Boundary', 'Commercial record only', "This document records MIDTS's commercial qualification of the enquiry. It does not constitute engineering approval, manufacturing feasibility confirmation, or technical certification. Engineering assessment will be completed independently by the selected engineering partner.")
      ],
      closingStatement: issueBlocked ? 'This Commercial Qualification Record is live-backed but blocked from final issue/render until required live fields are present.' : 'Commercial qualification controls whether MIDTS should proceed commercially. Engineering feasibility, manufacturing feasibility, material suitability, tolerance acceptance, and technical certification remain outside this document.',
      closingItems: issueBlocked ? missing.map(function (item) { return 'Blocked: ' + item; }) : [
        'Do not treat this record as engineering approval.',
        'Do not release partner-facing information until Vendor Safe Package controls are complete.',
        'Use controlled empty states only: Not Provided, Not Applicable, or Awaiting Confirmation.'
      ]
    };
  }

  function riskRows_(lead, intake, review) {
    var rows = [];
    if (!clean_(lead['Brief Requirement']) && !clean_(intake['Technical Scope'])) rows.push(['Unclear scope boundary', 'Quote may be delayed or incorrectly scoped.', 'Medium', 'Confirm scope through Step 2 intake and clarification register before partner package issue.', 'MIDTS Commercial Control', 'Open']);
    if (!clean_(intake['File Links']) && !clean_(intake['Files Provided']) && !clean_(lead['Files Provided'])) rows.push(['Missing or incomplete source files', 'Partner assessment may be blocked or qualified with assumptions.', 'Medium', 'Verify uploaded files or record file gap before Vendor Safe Package.', 'MIDTS Operations', 'Open']);
    if (!clean_(intake['Deadline']) && !clean_(intake['Timing Notes'])) rows.push(['Unconfirmed urgency', 'Partner availability and pricing may be affected.', 'Medium', 'Confirm required response and delivery dates before pricing.', 'MIDTS Commercial Control', 'Open']);
    if (!clean_(lead['NDA Required']) && !clean_(intake['NDA Required'])) rows.push(['NDA or confidentiality uncertainty', 'File release may be restricted.', 'Low', 'Confirm confidentiality classification before partner release.', 'MIDTS Commercial Control', 'Open']);
    if (clean_(review['Risks'])) rows.push(['Partner assessment risks recorded', clean_(review['Risks']), 'Recorded', 'Carry risks into Vendor Safe Package and pricing controls.', 'MIDTS / Partner', 'Recorded']);
    return rows.length ? rows : [['No commercial exception recorded', 'No blocking commercial risk currently recorded.', 'Low', 'Continue controlled workflow.', 'MIDTS Commercial Control', 'Recorded']];
  }

  function missingRows_(lead, intake, missing) {
    if (missing && missing.length) {
      return missing.map(function (item) {
        return [item, 'Required for final Commercial Qualification Record issue/render.', 'Blocks final issue/render.', 'MIDTS Commercial Control', 'Open', AWAITING];
      });
    }
    return [['None recorded', 'Minimum required live fields are present.', 'No block to final issue/render from this adapter.', 'MIDTS Commercial Control', 'Closed', NOT_APPLICABLE]];
  }

  function missingRequiredFields_(lead, intake) {
    var missing = [];
    if (!clean_(lead['Lead ID'])) missing.push('Lead ID');
    if (!clean_(lead['Full Name'])) missing.push('Client name');
    if (!clean_(lead['Email'])) missing.push('Client email');
    if (!clean_(lead['Brief Requirement']) && !clean_(intake['Technical Scope'])) missing.push('Requirement summary or technical scope');
    if (!clean_(lead['Qualification Decision'])) missing.push('Qualification decision');
    return missing;
  }

  function fileState_(lead, intake) {
    var links = clean_(intake['File Links']);
    var provided = clean_(intake['Files Provided'] || lead['Files Provided']);
    if (links) return { value: links, status: 'Confirmed' };
    if (provided) return { value: provided, status: 'Recorded without Drive links' };
    return { value: AWAITING, status: AWAITING };
  }

  function fieldsSection_(eyebrow, title, fields) {
    return { kind: 'fields', eyebrow: eyebrow, title: title, fields: fields };
  }

  function tableSection_(eyebrow, title, columns, rows) {
    return { kind: 'table', eyebrow: eyebrow, title: title, table: { columns: columns, rows: rows } };
  }

  function statementSection_(eyebrow, title, statement) {
    return { kind: 'statement', eyebrow: eyebrow, title: title, statement: statement };
  }

  function field_(label, value) {
    return { label: label, value: valueOrState_(value) };
  }

  function statusFromValue_(value) {
    return clean_(value) ? 'Recorded' : AWAITING;
  }

  function valueOrState_(value) {
    var cleaned = clean_(value);
    return cleaned || AWAITING;
  }

  function dateOnly_(value) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (String(date) === 'Invalid Date') return clean_(value);
    return Utilities.formatDate(date, 'Europe/London', 'yyyy-MM-dd');
  }

  function clean_(value) {
    return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  return {
    getCommercialQualificationRecord: getCommercialQualificationRecord
  };
})();