var MidtsDocumentAdapterService = (function () {
  var STATUSES = { draft: true, 'under review': true, approved: true, issued: true, superseded: true, withdrawn: true };

  function toDocumentControl(lead, documentType, options) {
    lead = lead || {};
    options = options || {};
    var issuedAt = options.issuedAt instanceof Date ? options.issuedAt : new Date();
    var validityDays = positiveInteger_(options.validityDays || MidtsConfig.getScriptProperty('QUOTE_VALIDITY_DAYS') || 30);
    var reference = String(options.reference || lead['Quote Reference'] || lead['Lead ID'] || '').trim();
    if (!reference) throw new Error('A document reference is required.');
    var status = status_(options.status || 'Draft');
    var preparedBy = MidtsConfig.getScriptProperty('DOCUMENT_PREPARED_BY') || 'MIDTS';

    return {
      documentTitle: title_(documentType),
      documentNumber: reference,
      leadProjectReference: String(lead['Lead ID'] || '').trim(),
      clientReference: String(lead['Company'] || lead['Full Name'] || '').trim(),
      partDrawingReference: String(options.partDrawingReference || '').trim(),
      documentType: String(documentType || '').trim(),
      reference: reference,
      revision: String(options.revision || '1'),
      status: status,
      purposeOfIssue: purpose_(options.purposeOfIssue || (status === 'Issued' ? 'For Quotation' : 'For Review')),
      preparedFor: client_(lead),
      preparedBy: preparedBy,
      technicallyReviewedBy: String(options.technicallyReviewedBy || '').trim(),
      approvedForIssueBy: String(options.approvedForIssueBy || '').trim(),
      issuedAt: issuedAt,
      dateIssued: date_(issuedAt),
      effectiveDate: options.effectiveDate ? date_(options.effectiveDate) : '',
      validUntil: addDays_(issuedAt, validityDays),
      validity: validityDays + ' Days From Issue',
      confidentialityClassification: String(options.confidentialityClassification || MidtsConfig.getScriptProperty('DOCUMENT_CONFIDENTIALITY') || 'Confidential').trim()
    };
  }

  function toRequirementSheetData(lead, technicalIntake, options) {
    lead = lead || {};
    technicalIntake = technicalIntake || {};
    options = options || {};
    var control = toDocumentControl(lead, 'requirementSheet', {
      reference: options.reference || technicalIntake['Technical Intake ID'] || lead['Lead ID'],
      revision: options.revision,
      status: options.status || 'Draft',
      purposeOfIssue: options.purposeOfIssue || 'For Review',
      issuedAt: options.issuedAt
    });
    var fields = [
      row_('Client', client_(lead)),
      row_('Requirement Source', lead['Source'] || 'Customer enquiry'),
      row_('Service Type', technicalIntake['Service Type'] || lead['Project Type']),
      row_('Material', technicalIntake['Materials']),
      row_('Quantity', technicalIntake['Quantity']),
      row_('Delivery Requirement', technicalIntake['Deadline']),
      row_('Files And Revisions Received', technicalIntake['File Links'] || technicalIntake['Files Provided']),
      row_('NDA Required', technicalIntake['NDA Required'])
    ].filter(function (item) { return item.value; });
    var inputs = [
      labelled_('Technical scope', technicalIntake['Technical Scope']),
      labelled_('Required deliverables', technicalIntake['Service Type']),
      labelled_('Known constraints', technicalIntake['Timing Notes']),
      labelled_('Customer clarifications', technicalIntake['Technical Notes'])
    ].filter(Boolean);
    var questions = [];
    if (!String(technicalIntake['Technical Scope'] || '').trim()) questions.push('Confirm the detailed technical scope before commercial quotation.');
    if (!String(technicalIntake['Deadline'] || '').trim()) questions.push('Confirm the required delivery deadline.');

    return {
      documentType: 'requirementSheet',
      status: control.status,
      purposeOfIssue: control.purposeOfIssue,
      documentControl: control,
      reference: control.reference,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      dateIssued: control.dateIssued,
      revision: control.revision,
      projectReference: String(lead['Lead ID'] || ''),
      title: 'Engineering Requirements Record',
      requirementSummary: String(technicalIntake['Technical Scope'] || lead['Brief Requirement'] || '').trim(),
      intakeFields: fields,
      technicalInputs: inputs,
      constraints: [labelled_('Confidentiality', technicalIntake['Confidentiality Notes'])].filter(Boolean),
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
      status: options.status || 'Draft',
      purposeOfIssue: options.purposeOfIssue || 'For Review',
      issuedAt: options.issuedAt,
      validityDays: options.validityDays
    });
    var currency = String(quote['Client Quote Currency'] || quote.currency || approvedPricing['Client Quote Currency'] || MidtsConfig.getScriptProperty('CLIENT_QUOTE_CURRENCY') || 'GBP').trim().toUpperCase();
    var total = money_(quote['Client Quote Amount'] || quote.amount || approvedPricing['Client Quote Amount'], currency);
    if (!total) throw new Error('An approved client quote amount is required.');
    var scope = String(quote.scopeSummary || lead['Brief Requirement'] || '').trim();
    if (!scope) throw new Error('A controlled quotation requires an approved scope summary.');

    return {
      documentType: 'quote',
      status: control.status,
      purposeOfIssue: control.purposeOfIssue,
      documentControl: control,
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
      status: options.status || 'Draft',
      purposeOfIssue: options.purposeOfIssue || 'For Review',
      technicallyReviewedBy: humanReview['Reviewer'] || '',
      issuedAt: options.issuedAt
    });

    return {
      documentType: 'technicalReview',
      status: control.status,
      purposeOfIssue: control.purposeOfIssue,
      documentControl: control,
      reference: control.reference,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      projectReference: String(lead['Lead ID'] || ''),
      dateIssued: control.dateIssued,
      revision: control.revision,
      title: 'Partner Technical Assessment Report',
      assessmentScope: String(humanReview['Assessment Scope'] || technicalIntake['Technical Scope'] || '').trim(),
      partnerOrganisation: String(humanReview['Reviewer Organisation'] || '').trim(),
      partnerReviewer: String(humanReview['Reviewer'] || '').trim(),
      feasibilityStatus: String(humanReview['Feasibility Status'] || '').trim(),
      reviewSummary: String(humanReview['Review Summary'] || '').trim(),
      fileReview: parseList_(humanReview['File Review']).map(function (finding) {
        return { area: 'Partner assessment input', finding: finding, status: 'Assessed' };
      }),
      risks: parseList_(humanReview['Risks'] || humanReview['Manufacturing Risks']),
      clarifications: parseList_(humanReview['Clarifications'] || humanReview['Clarifications Required']),
      recommendation: String(humanReview['Partner Technical Recommendation'] || humanReview['Recommendation'] || '').trim(),
      midtsQualificationDecision: String(humanReview['MIDTS Qualification Decision'] || '').trim()
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
      status: options.status || 'Draft',
      purposeOfIssue: options.purposeOfIssue || 'For Delivery',
      issuedAt: options.issuedAt
    });
    return {
      documentType: 'completionReport',
      status: control.status,
      purposeOfIssue: control.purposeOfIssue,
      documentControl: control,
      reference: control.reference,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      projectReference: String(project['Project ID'] || ''),
      dateIssued: control.dateIssued,
      revision: control.revision,
      title: 'Engineering Deliverables Handover Register',
      deliverySummary: String(deliveryRecord['Delivery Summary'] || '').trim(),
      deliveredFiles: parseList_(deliveryRecord['Delivered Files']),
      clientReviewStatus: String(deliveryRecord['Client Review Status'] || 'Pending client review').trim(),
      completedAt: deliveryRecord['Completed At'] || ''
    };
  }

  function toHandoverPackData(project, deliveryRecord, handoverRecord, options) {
    project = project || {};
    deliveryRecord = deliveryRecord || {};
    handoverRecord = handoverRecord || {};
    options = options || {};
    var lead = { 'Lead ID': project['Lead ID'] || options.leadId || '', 'Quote Reference': project['Quote Reference'] || '' };
    var control = toDocumentControl(lead, 'handoverPack', {
      reference: options.reference || handoverRecord['Handover ID'] || project['Project ID'],
      revision: options.revision || '1',
      status: options.status || 'Draft',
      purposeOfIssue: options.purposeOfIssue || 'For Delivery',
      issuedAt: options.issuedAt
    });
    return {
      documentType: 'handoverPack',
      status: control.status,
      purposeOfIssue: control.purposeOfIssue,
      documentControl: control,
      reference: control.reference,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      projectReference: String(project['Project ID'] || ''),
      dateIssued: control.dateIssued,
      revision: control.revision,
      title: 'Engineering Deliverables Handover Register',
      releaseNotes: String(handoverRecord['Release Notes'] || '').trim(),
      releasedFiles: parseList_(handoverRecord['Released Files']),
      deliverySummary: String(deliveryRecord['Delivery Summary'] || '').trim(),
      clientAcceptanceStatus: String(handoverRecord['Client Acceptance Status'] || 'Pending client acceptance').trim()
    };
  }

  function toInvoiceData(project, invoiceRecord, options) {
    project = project || {};
    invoiceRecord = invoiceRecord || {};
    options = options || {};
    var lead = { 'Lead ID': project['Lead ID'] || options.leadId || '', 'Quote Reference': project['Quote Reference'] || '' };
    var control = toDocumentControl(lead, 'invoice', {
      reference: options.reference || invoiceRecord['Invoice ID'] || project['Project ID'],
      revision: options.revision || '1',
      status: options.status || 'Draft',
      purposeOfIssue: options.purposeOfIssue || 'For Information',
      issuedAt: options.issuedAt
    });
    var currency = String(invoiceRecord['Currency'] || 'GBP').trim().toUpperCase();
    return {
      documentType: 'invoice',
      status: control.status,
      purposeOfIssue: control.purposeOfIssue,
      documentControl: control,
      reference: control.reference,
      preparedFor: control.preparedFor,
      preparedBy: control.preparedBy,
      projectReference: String(project['Project ID'] || ''),
      dateIssued: control.dateIssued,
      dueDate: invoiceRecord['Due Date'] || '',
      currency: currency,
      amount: money_(invoiceRecord['Amount'], currency),
      paymentTerms: String(invoiceRecord['Payment Terms'] || '').trim(),
      invoiceStatus: String(invoiceRecord['Invoice Status'] || 'Draft').trim()
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
      return { templateKey: key, recipient: MidtsConfig.getScriptProperty('INTAKE_EMAIL') || 'midts.systems@gmail.com', subject: 'MIDTS partner technical assessment required - ' + leadId, data: { leadId: leadId, clientName: clientName, company: lead['Company'] || '', projectType: lead['Project Type'] || '' } };
    }
    return { templateKey: key, recipient: String(lead['Email'] || lead.email || '').trim(), subject: 'MIDTS enquiry received - ' + leadId, data: { leadId: leadId, clientName: clientName, projectType: lead['Project Type'] || '' } };
  }

  function parseList_(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    var text = String(value || '').trim();
    if (!text) return [];
    try { var parsed = JSON.parse(text); if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean); } catch (error) {}
    return text.split(/\r?\n|;/).map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function title_(documentType) {
    var key = String(documentType || '').trim();
    if (key === 'quote') return 'Controlled Quotation';
    if (key === 'requirementSheet') return 'Engineering Requirements Record';
    if (key === 'technicalReview') return 'Partner Technical Assessment Report';
    if (key === 'sow') return 'Statement of Work';
    if (key === 'completionReport' || key === 'handoverPack') return 'Engineering Deliverables Handover Register';
    if (key === 'invoice') return 'Invoice Record';
    return key || 'Controlled Document';
  }

  function purpose_(value) {
    var text = String(value || '').trim();
    var allowed = ['For Information', 'For Review', 'For Approval', 'For Quotation', 'For Delivery'];
    return allowed.indexOf(text) !== -1 ? text : 'For Review';
  }

  function status_(value) {
    var normalized = String(value || '').trim().toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
    if (!STATUSES[normalized]) return 'Draft';
    return normalized.split(' ').map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); }).join(' ');
  }

  function client_(lead) { return String(lead['Full Name'] || lead.fullName || lead['Company'] || 'Client').trim(); }
  function row_(label, value) { return { label: label, value: String(value || '').trim() }; }
  function labelled_(label, value) { var text = String(value || '').trim(); return text ? { label: label, value: text } : null; }
  function date_(value) { var date = value instanceof Date ? value : new Date(value); return Utilities.formatDate(date, 'Europe/London', 'yyyy-MM-dd'); }
  function addDays_(date, days) { return new Date(date.getTime() + days * 24 * 60 * 60 * 1000); }
  function positiveInteger_(value) { var parsed = Number(value); return isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 30; }
  function money_(value, currency) {
    var parsed = Number(String(value === undefined || value === null ? '' : value).replace(/[^0-9.-]/g, ''));
    if (!isFinite(parsed)) return '';
    var code = String(currency || 'GBP').toUpperCase();
    return (code === 'GBP' ? '£' : code + ' ') + parsed.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return {
    toDocumentControl: toDocumentControl,
    toRequirementSheetData: toRequirementSheetData,
    toQuoteData: toQuoteData,
    toTechnicalReviewData: toTechnicalReviewData,
    toCompletionReportData: toCompletionReportData,
    toHandoverPackData: toHandoverPackData,
    toInvoiceData: toInvoiceData,
    toEmailPayload: toEmailPayload
  };
})();