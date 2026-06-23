var MidtsInvoiceService = (function () {
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
  return { issueInvoice:issueInvoice };
})();