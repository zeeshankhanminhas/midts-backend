var MidtsInvoiceService = (function () {
  function listPendingInvoices() {
    var projects = read_(MidtsSheetService.SHEETS.PROJECTS, MidtsSheetService.PROJECT_HEADERS);
    var leads = read_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var invoices = read_(MidtsSheetService.SHEETS.INVOICES, MidtsSheetService.INVOICE_HEADERS);
    var pricingRows = read_(MidtsSheetService.SHEETS.VENDOR_PRICING, MidtsSheetService.VENDOR_PRICING_HEADERS);

    var leadsById = indexBy_(leads, 'Lead ID');
    var invoicesByProject = invoices.reduce(function (map, invoice) {
      var projectId = clean_(invoice['Project ID']);
      if (projectId) map[projectId] = invoice;
      return map;
    }, {});
    var latestPricingByLead = latestPricingByLead_(pricingRows);

    var pending = projects.filter(function (project) {
      var projectId = clean_(project['Project ID']);
      var leadId = clean_(project['Lead ID']);
      var lead = leadsById[leadId];
      if (!projectId || !leadId || invoicesByProject[projectId]) return false;
      if (clean_(project['Project Status']) !== 'Open') return false;
      if (!lead || clean_(lead['Lifecycle Status']) !== 'Project Active') return false;
      var pricing = latestPricingByLead[leadId];
      return pricing && clean_(pricing['Pricing Status']) === 'Margin Approved' && isYes_(pricing['Pricing Approved']) && parseMoney_(pricing['Client Quote Amount']) !== null;
    }).map(function (project) {
      var leadId = clean_(project['Lead ID']);
      return toPendingInvoiceRecord_(project, leadsById[leadId], latestPricingByLead[leadId]);
    });

    pending.sort(function (a, b) {
      return Number(new Date(b.projectCreatedAt || 0)) - Number(new Date(a.projectCreatedAt || 0));
    });

    return { ok:true, count:pending.length, invoices:pending };
  }

  function createInvoiceFromProject(payload) {
    payload = payload || {};
    var projectId = clean_(payload.projectId || payload.project_id);
    var leadId = clean_(payload.leadId || payload.lead_id);
    if (!projectId && !leadId) return { ok:false, code:'MISSING_PROJECT_REFERENCE', message:'Project or lead reference is required.' };

    var projectResult = projectId ? MidtsSheetService.findProjectById(projectId) : MidtsSheetService.findProjectByLeadId(leadId);
    if (!projectResult) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Project was not found.' };

    var project = projectResult.project;
    projectId = clean_(project['Project ID']);
    leadId = clean_(project['Lead ID']);
    if (clean_(project['Project Status']) !== 'Open') return { ok:false, code:'PROJECT_NOT_OPEN', message:'Only open projects can be invoiced.' };

    var existingInvoice = MidtsSheetService.findLatestInvoiceByProjectId(projectId);
    if (existingInvoice) return toInvoiceResult_(existingInvoice.invoice, true);

    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok:false, code:'LEAD_NOT_FOUND', message:'Lead not found for project: ' + leadId };
    if (clean_(leadResult.lead['Lifecycle Status']) !== 'Project Active') return { ok:false, code:'LEAD_NOT_PROJECT_ACTIVE', message:'Lead must be Project Active before invoice creation.' };

    var pricingResult = MidtsSheetService.findLatestVendorPricingByLeadId(leadId);
    if (!pricingResult || clean_(pricingResult.pricing['Pricing Status']) !== 'Margin Approved' || !isYes_(pricingResult.pricing['Pricing Approved'])) {
      return { ok:false, code:'APPROVED_PRICING_NOT_FOUND', message:'Approved pricing is required before invoice creation.' };
    }

    var amount = parseMoney_(pricingResult.pricing['Client Quote Amount']);
    if (amount === null) return { ok:false, code:'INVOICE_AMOUNT_MISSING', message:'Client quote amount is missing on approved pricing.' };

    var now = new Date();
    var dueDays = parseDueDays_(payload.dueDays || payload.due_days || 14);
    var dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);
    var createdBy = clean_(payload.creator || payload.reviewer || payload.actor) || 'MIDTS Billing Control';
    var paymentTerms = clean_(payload.paymentTerms || payload.payment_terms) || ('Due ' + dueDays + ' days from issue');
    var invoiceId = 'INV-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    var quoteReference = clean_(project['Quote Reference'] || leadResult.lead['Quote Reference'] || pricingResult.pricing['Quote Reference']);
    var currency = clean_(pricingResult.pricing['Client Quote Currency'] || pricingResult.pricing['Vendor Currency']);

    MidtsSheetService.appendInvoiceRow([
      invoiceId,
      projectId,
      leadId,
      quoteReference,
      now,
      createdBy,
      'Draft',
      currency,
      amount,
      paymentTerms,
      dueDate,
      '',
      '',
      now
    ]);

    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Next Action': 'Issue invoice',
      'Next Action Due': dueDate,
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'INVOICE-CREATE-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'invoice_created',
      message: 'Invoice record created from active project',
      payload: {
        invoiceId: invoiceId,
        projectId: projectId,
        leadId: leadId,
        quoteReference: quoteReference,
        currency: currency,
        amount: amount,
        paymentTerms: paymentTerms,
        dueDate: dueDate.toISOString(),
        createdBy: createdBy
      },
      submissionId: clean_(updatedLead.lead['Submission ID']),
      email: clean_(updatedLead.lead['Email']),
      source: 'Invoice Service'
    });

    return { ok:true, invoiceId:invoiceId, projectId:projectId, leadId:leadId, quoteReference:quoteReference, invoiceStatus:'Draft', currency:currency, amount:amount, paymentTerms:paymentTerms, dueDate:dueDate.toISOString(), nextAction:'Issue invoice' };
  }

  function issueInvoice(projectId, details, actor) {
    if (!projectId) return { ok:false, code:'MISSING_PROJECT_ID', message:'Project ID is required.' };
    details = details || {};
    var projectResult = MidtsSheetService.findProjectById(projectId);
    if (!projectResult) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Project not found: ' + projectId };
    var handover = MidtsSheetService.findLatestHandoverRecordByProjectId(projectId);
    if (!handover || String(handover.handoverRecord['Handover Status'] || '') !== 'Released') {
      return { ok:false, code:'HANDOVER_NOT_RELEASED', message:'A released handover record is required before issuing an invoice.' };
    }
    if (MidtsSheetService.findLatestInvoiceByProjectId(projectId)) {
      return { ok:false, code:'INVOICE_ALREADY_ISSUED', message:'An invoice record already exists for this project.' };
    }
    var amount = Number(String(details.amount || '').replace(/[^0-9.-]/g, ''));
    if (!isFinite(amount) || amount <= 0) return { ok:false, code:'INVALID_AMOUNT', message:'A positive invoice amount is required.' };
    var currency = String(details.currency || MidtsConfig.getScriptProperty('CLIENT_QUOTE_CURRENCY') || 'GBP').trim().toUpperCase();
    var paymentTerms = String(details.paymentTerms || MidtsConfig.getScriptProperty('QUOTE_PAYMENT_TERMS') || 'Payment due within 14 days of invoice.').trim();
    var dueDate = details.dueDate || '';
    if (!dueDate) return { ok:false, code:'MISSING_DUE_DATE', message:'An invoice due date is required.' };
    var now = new Date();
    var invoiceId = 'INV-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    var project = projectResult.project;
    MidtsSheetService.appendInvoiceRow([
      invoiceId, projectId, project['Lead ID'] || '', project['Quote Reference'] || '', now,
      actor || 'MIDTS Finance Control', 'Issued', currency, amount, paymentTerms,
      dueDate, now, '', now
    ]);
    MidtsSheetService.updateLeadById(project['Lead ID'], {
      'Lifecycle Status':'Invoice Issued',
      'Next Action':'Monitor payment',
      'Next Action Due':dueDate,
      'Last Updated At':now
    });
    return { ok:true, invoiceId:invoiceId, projectId:projectId, nextAction:'Monitor payment' };
  }

  function toPendingInvoiceRecord_(project, lead, pricing) {
    return {
      projectId: clean_(project['Project ID']),
      leadId: clean_(project['Lead ID']),
      client: clean_(lead && lead['Full Name']),
      company: clean_(lead && lead['Company']),
      email: clean_(lead && lead['Email']),
      projectType: clean_(lead && lead['Project Type']),
      briefRequirement: clean_(lead && lead['Brief Requirement']),
      quoteReference: clean_(project['Quote Reference'] || pricing['Quote Reference']),
      projectStatus: clean_(project['Project Status']),
      lifecycleStatus: clean_(lead && lead['Lifecycle Status']),
      amount: clean_(pricing['Client Quote Amount']),
      currency: clean_(pricing['Client Quote Currency'] || pricing['Vendor Currency']),
      pricingId: clean_(pricing['Pricing ID']),
      pricingApprovedAt: formatDate_(pricing['Pricing Approved At']),
      projectCreatedAt: formatDate_(project['Created At']),
      driveFolderUrl: clean_(project['Drive Folder URL']),
      sourceDocumentId: clean_(project['Source Document ID'])
    };
  }

  function toInvoiceResult_(invoice, alreadyCreated) {
    return {
      ok:true,
      alreadyCreated:Boolean(alreadyCreated),
      invoiceId:clean_(invoice['Invoice ID']),
      projectId:clean_(invoice['Project ID']),
      leadId:clean_(invoice['Lead ID']),
      quoteReference:clean_(invoice['Quote Reference']),
      invoiceStatus:clean_(invoice['Invoice Status']),
      currency:clean_(invoice['Currency']),
      amount:parseMoney_(invoice['Amount']),
      paymentTerms:clean_(invoice['Payment Terms']),
      dueDate:formatDate_(invoice['Due Date'])
    };
  }

  function latestPricingByLead_(rows) {
    return rows.reduce(function (map, pricing) {
      var leadId = clean_(pricing['Lead ID']);
      if (!leadId) return map;
      var existing = map[leadId];
      if (!existing || isYes_(pricing['Latest Revision']) || Number(new Date(pricing['Last Updated At'] || pricing['Created At'] || 0)) >= Number(new Date(existing['Last Updated At'] || existing['Created At'] || 0))) map[leadId] = pricing;
      return map;
    }, {});
  }

  function indexBy_(rows, key) {
    return rows.reduce(function (map, row) {
      var id = clean_(row[key]);
      if (id) map[id] = row;
      return map;
    }, {});
  }

  function read_(sheetName, expectedHeaders) {
    var id = MidtsConfig.getSpreadsheetId();
    var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss && ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues().map(function (row) {
      var result = {};
      headers.forEach(function (header, index) { if (header) result[header] = row[index] instanceof Date ? row[index].toISOString() : clean_(row[index]); });
      expectedHeaders.forEach(function (header) { if (result[header] === undefined) result[header] = ''; });
      return result;
    });
  }

  function parseDueDays_(value) {
    var parsed = Number(value);
    if (!isFinite(parsed) || parsed < 0 || parsed > 120) return 14;
    return Math.round(parsed);
  }

  function parseMoney_(value) {
    var parsed = Number(String(value === undefined || value === null ? '' : value).replace(/[^0-9.-]/g, ''));
    return isFinite(parsed) ? parsed : null;
  }

  function formatDate_(value) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (String(date) === 'Invalid Date') return clean_(value);
    return date.toISOString();
  }

  function isYes_(value) { var normalized = clean_(value).toLowerCase(); return normalized === 'yes' || normalized === 'true' || normalized === 'approved'; }
  function clean_(value) { return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim(); }

  return { listPendingInvoices:listPendingInvoices, createInvoiceFromProject:createInvoiceFromProject, issueInvoice:issueInvoice };
})();