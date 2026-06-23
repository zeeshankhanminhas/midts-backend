var MidtsDocumentAdapterService = (function () {
  var STATUSES = { draft: true, approved: true, issued: true, superseded: true };

  function toDocumentControl(lead, documentType, options) {
    lead = lead || {};
    options = options || {};
    var issuedAt = options.issuedAt instanceof Date ? options.issuedAt : new Date();
    var validityDays = positiveInteger_(options.validityDays || MidtsConfig.getScriptProperty('QUOTE_VALIDITY_DAYS') || 30);
    var reference = String(options.reference || lead['Quote Reference'] || lead['Lead ID'] || '').trim();
    if (!reference) throw new Error('A document reference is required.');

    return {
      documentType: String(documentType || '').trim(),
      reference: reference,
      revision: String(options.revision || '1'),
      status: status_(options.status || 'draft'),
      preparedFor: client_(lead),
      preparedBy: MidtsConfig.getScriptProperty('DOCUMENT_PREPARED_BY') || 'MIDTS',
      issuedAt: issuedAt,
      dateIssued: date_(issuedAt),
      validUntil: addDays_(issuedAt, validityDays),
      validity: validityDays + ' Days From Issue'
    };
  }

  function toRequirementSheetData(lead, technicalIntake, options) {
    lead = lead || {};
    technicalIntake = technicalIntake || {};
    options = options || {};
    var control = toDocumentControl(lead, 'requirementSheet', {
      reference: options.reference || technicalIntake['Technical Intake ID'] || lead['Lead ID'],
      revision: options.revision,
      status: options.status || 'draft',
      issuedAt: options.issuedAt
    });
    var fields = [
      row_('Client', client_(lead)),
      row_('Service Type', technicalIntake['Service Type'] || lead['Project Type']),
      row_('Quantity', technicalIntake['Quantity']),
      row_('Target Deadline', technicalIntake['Deadline']),
      row_('Budget Range', technicalIntake['Budget Range']),
      row_('Files Provided', technicalIntake['Files Provided']),
      row_('NDA Required', technicalIntake['NDA Required'])
    ].filter(function (item) { return item.value; });
    var inputs = [
      labelled_('Technical scope', technicalIntake['Technical Scope']),
      labelled_('Materials', technicalIntake['Materials']),
      labelled_('File links', technicalIntake['File Links']),
      labelled_('Technical notes', technicalIntake['Technical Notes'])
    ].filter(Boolean);
    var constraints = [
      labelled_('Deadline', technicalIntake['Deadline']),
      labelled_('Timing notes', technicalIntake['Timing Notes']),
      labelled_('Confidentiality', technicalIntake['Confidentiality Notes']),
      labelled_('NDA requirement', technicalIntake['NDA Required'])
    ].filter(Boolean);
    var questions = [];
    if (!String(technicalIntake['Technical Scope'] || '').trim()) questions.push('Confirm the detailed technical scope before commercial quotation.');
    if (!String(technicalIntake['Deadline'] || '').trim()) questions.push('Confirm the required delivery deadline.');

    return {
      documentType: 'requirementSheet',
      status: control.status,
      reference: control.reference,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      dateIssued: control.dateIssued,
      revision: control.revision,
      projectReference: String(lead['Lead ID'] || ''),
      title: 'Technical Requirement Sheet',
      requirementSummary: String(technicalIntake['Technical Scope'] || lead['Brief Requirement'] || '').trim(),
      intakeFields: fields,
      technicalInputs: inputs,
      constraints: constraints,
      openQuestions: questions
    };
  }

  function toQuoteData(lead, quote, approvedPricing, options) {
    lead = lead || {};
    quote = quote || {};
    approvedPricing = approvedPricing || {};
    options = options || {};
    var reference = String(quote['Quote Reference'] || quote.reference || approvedPricing['Quote Reference'] || lead['Quote Reference'] || '').trim();
    var control = toDocumentControl(lead, 'quote', {
      reference: reference,
      revision: options.revision || quote['Quote Revision'] || approvedPricing['Quote Revision'] || '1',
      status: options.status || 'draft',
      issuedAt: options.issuedAt,
      validityDays: options.validityDays
    });
    var currency = String(quote['Client Quote Currency'] || quote.currency || approvedPricing['Client Quote Currency'] || MidtsConfig.getScriptProperty('CLIENT_QUOTE_CURRENCY') || 'GBP').trim().toUpperCase();
    var total = money_(quote['Client Quote Amount'] || quote.amount || approvedPricing['Client Quote Amount'], currency);
    if (!total) throw new Error('An approved client quote amount is required.');
    var scope = String(quote.scopeSummary || lead['Brief Requirement'] || 'Engineering support in line with the agreed project scope.').trim();

    return {
      documentType: 'quote',
      status: control.status,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      reference: control.reference,
      projectReference: String(quote.projectReference || lead['Lead ID'] || ''),
      dateIssued: control.dateIssued,
      revision: control.revision,
      validity: control.validity,
      validUntil: date_(control.validUntil),
      currency: currency,
      scopeSummary: scope,
      lineItems: [{ item: '01', description: 'Engineering support in line with the approved project scope.', quantity: '1', rate: total, total: total }],
      totals: { subtotal: total, vat: MidtsConfig.getScriptProperty('QUOTE_VAT_TEXT') || 'Subject to VAT where applicable', total: total },
      assumptions: ['Source data and project inputs are supplied before work commences.', 'Client review feedback is consolidated into a single controlled response.'],
      exclusions: ['Additional revisions outside the agreed scope summary.', 'Third-party costs unless separately stated in this quote.'],
      paymentTerms: [MidtsConfig.getScriptProperty('QUOTE_PAYMENT_TERMS') || 'Payment terms are 14 days from invoice unless otherwise agreed.'],
      approval: {
        clientParty: control.preparedFor,
        supplierParty: control.preparedBy,
        confirmationText: 'Approval confirms acceptance of the quoted scope, commercial value, assumptions, exclusions, and payment terms stated in this document.'
      }
    };
  }

  function toTechnicalReviewData(lead, technicalIntake, humanReview, options) {
    lead = lead || {};
    technicalIntake = technicalIntake || {};
    humanReview = humanReview || {};
    options = options || {};
    var control = toDocumentControl(lead, 'technicalReview', {
      reference: options.reference || humanReview['Technical Review ID'] || lead['Lead ID'],
      revision: options.revision || '1',
      status: options.status || 'draft',
      issuedAt: options.issuedAt
    });

    return {
      documentType: 'technicalReview',
      status: control.status,
      reference: control.reference,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      projectReference: String(lead['Lead ID'] || ''),
      dateIssued: control.dateIssued,
      revision: control.revision,
      title: 'Technical Review',
      reviewSummary: String(humanReview['Review Summary'] || '').trim(),
      fileReview: parseList_(humanReview['File Review']).map(function (finding) {
        return { area: 'Technical input', finding: finding, status: 'Reviewed' };
      }),
      risks: parseList_(humanReview['Risks']),
      clarifications: parseList_(humanReview['Clarifications']),
      recommendation: String(humanReview['Recommendation'] || '').trim()
    };
  }

  function toCompletionReportData(project, deliveryRecord, options) {
    project = project || {};
    deliveryRecord = deliveryRecord || {};
    options = options || {};
    var lead = { 'Lead ID': project['Lead ID'] || options.leadId || '', 'Quote Reference': project['Quote Reference'] || '' };
    var control = toDocumentControl(lead, 'completionReport', {
      reference: options.reference || deliveryRecord['Delivery Record ID'] || project['Project ID'],
      revision: options.revision || '1',
      status: options.status || 'issued',
      issuedAt: options.issuedAt
    });
    return {
      documentType: 'completionReport',
      status: control.status,
      reference: control.reference,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      projectReference: String(project['Project ID'] || ''),
      dateIssued: control.dateIssued,
      revision: control.revision,
      title: 'Completion Report',
      deliverySummary: String(deliveryRecord['Delivery Summary'] || '').trim(),
      deliveredFiles: parseList_(deliveryRecord['Delivered Files']),
      clientReviewStatus: String(deliveryRecord['Client Review Status'] || 'Pending client review').trim(),
      completedAt: deliveryRecord['Completed At'] || ''
    };
  }

  function toEmailPayload(templateKey, lead, quote, project) {
    lead = lead || {};
    quote = quote || {};
    project = project || {};
    var key = String(templateKey || 'enquiryAcknowledgement').trim();
    var clientName = String(lead['Full Name'] || lead.fullName || 'there').trim();
    var leadId = String(lead['Lead ID'] || lead.leadId || '').trim();
    var quoteReference = String(quote['Quote Reference'] || quote.reference || lead['Quote Reference'] || '').trim();
    if (key === 'quoteIssued') {
      return { templateKey: key, recipient: String(lead['Email'] || lead.email || '').trim(), subject: 'Your MIDTS quote - ' + quoteReference, data: { clientName: clientName, leadId: leadId, quoteReference: quoteReference } };
    }
    if (key === 'technicalReviewRequired') {
      return { templateKey: key, recipient: MidtsConfig.getScriptProperty('INTAKE_EMAIL') || 'midts.systems@gmail.com', subject: 'MIDTS technical review required - ' + leadId, data: { leadId: leadId, clientName: clientName, company: lead['Company'] || '', projectType: lead['Project Type'] || '' } };
    }
    return { templateKey: key, recipient: String(lead['Email'] || lead.email || '').trim(), subject: 'MIDTS enquiry received - ' + leadId, data: { leadId: leadId, clientName: clientName, projectType: lead['Project Type'] || '' } };
  }

  function parseList_(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    var text = String(value || '').trim();
    if (!text) return [];
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch (error) {}
    return text.split(/\r?\n|;/).map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function status_(value) {
    var status = String(value || '').trim().toLowerCase();
    if (!STATUSES[status]) throw new Error('Unsupported document status: ' + status);
    return status;
  }
  function client_(lead) {
    return [String(lead['Full Name'] || lead.fullName || '').trim(), String(lead['Company'] || lead.company || '').trim()].filter(Boolean).join(' | ') || 'Client';
  }
  function positiveInteger_(value) {
    var number = Number(value);
    return isFinite(number) && number > 0 ? Math.floor(number) : 30;
  }
  function addDays_(date, days) {
    var value = new Date(date.getTime());
    value.setDate(value.getDate() + days);
    return value;
  }
  function date_(value) {
    return Utilities.formatDate(value, 'Europe/London', 'd MMMM yyyy');
  }
  function money_(value, currency) {
    var amount = Number(String(value || '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    if (!isFinite(amount)) return '';
    return (String(currency || 'GBP').toUpperCase() === 'GBP' ? '£' : String(currency || 'GBP').toUpperCase() + ' ') + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function row_(label, value) { return { label: label, value: String(value || '').trim() }; }
  function labelled_(label, value) { var text = String(value || '').trim(); return text ? label + ': ' + text : ''; }

  return {
    toDocumentControl: toDocumentControl,
    toRequirementSheetData: toRequirementSheetData,
    toQuoteData: toQuoteData,
    toTechnicalReviewData: toTechnicalReviewData,
    toCompletionReportData: toCompletionReportData,
    toEmailPayload: toEmailPayload
  };
})();
