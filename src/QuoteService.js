var MidtsQuoteService = (function () {
  function prepareQuoteDraft(leadId, preparer) {
    if (!leadId) {
      return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required for quote preparation.' };
    }

    var existingLead = MidtsSheetService.findLeadById(leadId);
    if (!existingLead) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    }

    var leadGuard = guardLeadReadyForQuoteDraft_(existingLead.lead);
    if (!leadGuard.ok) return leadGuard;

    var latestPricing = MidtsSheetService.findLatestVendorPricingByLeadId(leadId);
    if (!latestPricing) {
      return { ok: false, code: 'VENDOR_PRICING_NOT_FOUND', message: 'No vendor pricing row found for lead: ' + leadId };
    }

    if (!isYes_(latestPricing.pricing['Pricing Approved'])) {
      return { ok: false, code: 'MARGIN_NOT_APPROVED', message: 'Latest pricing revision must be approved before quote preparation.' };
    }

    var quoteReference = existingLead.lead['Quote Reference'] || latestPricing.pricing['Quote Reference'] || createQuoteReference_();
    existingLead.lead['Quote Reference'] = quoteReference;
    var quoteSnapshot = MidtsDocumentService.createQuoteSnapshot(existingLead.lead, latestPricing.pricing);
    var quoteDocumentLink = buildQuoteDocumentLink_(quoteReference, leadId, existingLead.lead, latestPricing.pricing, quoteSnapshot.documentId);
    var now = new Date();
    var preparedBy = preparer || 'Apps Script Test';

    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Lifecycle Status': 'Quote Draft',
      'Next Action': 'Review quote draft',
      'Next Action Due': now,
      'Quote Required': 'Yes',
      'Quote Reference': quoteReference,
      'Quote Status': 'Draft Prepared',
      'Quote Document Link': quoteDocumentLink,
      'Reviewer': preparedBy,
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'QUOTE-DRAFT-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'quote_draft_prepared',
      message: 'Quote draft prepared; ready for human review',
      payload: {
        leadId: leadId,
        pricingId: latestPricing.pricing['Pricing ID'],
        quoteReference: quoteReference,
        quoteDocumentLink: quoteDocumentLink,
        quoteSnapshotId: quoteSnapshot.documentId,
        clientQuoteAmount: latestPricing.pricing['Client Quote Amount'] || '',
        preparedBy: preparedBy
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Quote Service'
    });

    return {
      ok: true,
      leadId: leadId,
      pricingId: latestPricing.pricing['Pricing ID'],
      quoteReference: quoteReference,
      quoteStatus: 'Draft Prepared',
      lifecycleStatus: 'Quote Draft',
      nextAction: 'Review quote draft',
      quoteDocumentLink: quoteDocumentLink,
      quoteSnapshotId: quoteSnapshot.documentId,
      clientQuoteAmount: latestPricing.pricing['Client Quote Amount'] || ''
    };
  }

  function refreshQuoteDocumentLink(leadId) {
    if (!leadId) {
      return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required to refresh quote document link.' };
    }

    var existingLead = MidtsSheetService.findLeadById(leadId);
    if (!existingLead) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    }

    var stageGuard = guardLeadHasQuoteDraft_(existingLead.lead);
    if (!stageGuard.ok) return stageGuard;

    var quoteReference = String(existingLead.lead['Quote Reference'] || '').trim();
    if (!quoteReference) {
      return { ok: false, code: 'QUOTE_REFERENCE_MISSING', message: 'Quote reference is required to refresh quote document link.' };
    }

    var latestPricing = MidtsSheetService.findLatestVendorPricingByLeadId(leadId);
    if (!latestPricing) {
      return { ok: false, code: 'VENDOR_PRICING_NOT_FOUND', message: 'Approved vendor pricing is required to refresh the quote document link.' };
    }

    var quoteDocument = MidtsDocumentService.getQuoteDocument({ leadId: leadId, quoteReference: quoteReference });
    var quoteSnapshotId = quoteDocument && quoteDocument.ok && quoteDocument.quoteDocument ? quoteDocument.quoteDocument.quoteSnapshotId : '';
    var quoteDocumentLink = buildQuoteDocumentLink_(quoteReference, leadId, existingLead.lead, latestPricing.pricing, quoteSnapshotId);
    if (!quoteDocumentLink) {
      return { ok: false, code: 'QUOTE_TEMPLATE_URL_MISSING', message: 'Set WORKSPACE_BASE_URL or FRONTEND_BASE_URL to the private workspace quote route.' };
    }

    var now = new Date();
    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Quote Document Link': quoteDocumentLink,
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'QUOTE-LINK-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'quote_document_link_refreshed',
      message: 'Quote document link refreshed from quote snapshot and private workspace route',
      payload: {
        leadId: leadId,
        quoteReference: quoteReference,
        quoteSnapshotId: quoteSnapshotId,
        quoteStatus: updatedLead.lead['Quote Status'] || '',
        quoteDocumentLink: quoteDocumentLink
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Quote Service'
    });

    return {
      ok: true,
      leadId: leadId,
      quoteReference: quoteReference,
      quoteSnapshotId: quoteSnapshotId,
      quoteStatus: updatedLead.lead['Quote Status'] || '',
      lifecycleStatus: updatedLead.lead['Lifecycle Status'] || '',
      quoteDocumentLink: quoteDocumentLink
    };
  }

  function approveQuoteDraft(leadId, approver) {
    if (!leadId) {
      return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required for quote approval.' };
    }

    var existingLead = MidtsSheetService.findLeadById(leadId);
    if (!existingLead) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    }

    var leadGuard = guardLeadReadyForQuoteApproval_(existingLead.lead);
    if (!leadGuard.ok) return leadGuard;

    var quoteReference = existingLead.lead['Quote Reference'];
    var sourceQuoteUrl = withDocumentStatus_(existingLead.lead['Quote Document Link'], 'approved');
    var now = new Date();
    var approvedBy = approver || 'Apps Script Test';
    var snapshotApproval = MidtsDocumentService.approveQuoteSnapshot(leadId, quoteReference, approvedBy);
    if (!snapshotApproval.ok) {
      return { ok: false, code: 'QUOTE_SNAPSHOT_NOT_FOUND', message: snapshotApproval.message };
    }

    var renderResult = MidtsPdfRenderService.renderApprovedQuotePdf(leadId, quoteReference, sourceQuoteUrl);
    if (!renderResult.ok) {
      return { ok: false, code: 'QUOTE_PDF_RENDER_FAILED', message: renderResult.message };
    }

    var documentResult = MidtsDocumentService.attachQuotePdf(leadId, quoteReference, renderResult.driveFileId, renderResult.driveUrl);
    if (!documentResult.ok) {
      return { ok: false, code: 'QUOTE_PDF_AUDIT_FAILED', message: documentResult.message };
    }

    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Lifecycle Status': 'Quote Approved',
      'Next Action': 'Send quote to client',
      'Next Action Due': now,
      'Quote Status': 'Approved to Send',
      'Quote Document Link': documentResult.driveUrl,
      'Reviewer': approvedBy,
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'QUOTE-APPROVAL-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'quote_approved_pdf_generated',
      message: 'Quote draft approved and PDF generated in Drive',
      payload: {
        leadId: leadId,
        quoteReference: updatedLead.lead['Quote Reference'] || '',
        documentId: documentResult.documentId,
        driveFileId: documentResult.driveFileId,
        driveUrl: documentResult.driveUrl,
        approvedBy: approvedBy
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Quote Service'
    });

    return {
      ok: true,
      leadId: leadId,
      quoteReference: updatedLead.lead['Quote Reference'] || '',
      quoteDocumentLink: documentResult.driveUrl,
      quoteStatus: 'Approved to Send',
      lifecycleStatus: 'Quote Approved',
      nextAction: 'Send quote to client'
    };
  }

  function guardLeadReadyForQuoteDraft_(lead) {
    if (String(lead['Lifecycle Status'] || '').trim() !== 'Quote Preparation') {
      return { ok: false, code: 'LEAD_NOT_IN_QUOTE_PREPARATION', message: 'Lead lifecycle must be Quote Preparation before preparing a quote draft.' };
    }
    if (String(lead['Quote Status'] || '').trim() !== 'Ready for Quote Draft') {
      return { ok: false, code: 'QUOTE_NOT_READY_FOR_DRAFT', message: 'Quote status must be Ready for Quote Draft before preparing quote.' };
    }
    if (String(lead['Vendor Pricing Status'] || '').trim() !== 'Margin Approved') {
      return { ok: false, code: 'MARGIN_NOT_APPROVED', message: 'Margin must be approved before quote preparation.' };
    }
    return { ok: true };
  }

  function guardLeadHasQuoteDraft_(lead) {
    var quoteStatus = String(lead['Quote Status'] || '').trim();
    var lifecycleStatus = String(lead['Lifecycle Status'] || '').trim();
    if (quoteStatus !== 'Draft Prepared' || lifecycleStatus !== 'Quote Draft') {
      return {
        ok: false,
        code: 'QUOTE_DRAFT_NOT_AVAILABLE',
        message: 'Quote source link can only be refreshed while the quote is in draft. Current Quote Status: ' + quoteStatus + '; Lifecycle Status: ' + lifecycleStatus + '.'
      };
    }
    return { ok: true };
  }

  function guardLeadReadyForQuoteApproval_(lead) {
    if (String(lead['Lifecycle Status'] || '').trim() !== 'Quote Draft') {
      return { ok: false, code: 'LEAD_NOT_IN_QUOTE_DRAFT', message: 'Lead lifecycle must be Quote Draft before approving quote.' };
    }
    if (String(lead['Quote Status'] || '').trim() !== 'Draft Prepared') {
      return { ok: false, code: 'QUOTE_DRAFT_NOT_PREPARED', message: 'Quote status must be Draft Prepared before approval.' };
    }
    if (!String(lead['Quote Reference'] || '').trim()) {
      return { ok: false, code: 'QUOTE_REFERENCE_MISSING', message: 'Quote reference is required before approval.' };
    }
    if (!String(lead['Quote Document Link'] || '').trim()) {
      return { ok: false, code: 'QUOTE_DOCUMENT_LINK_MISSING', message: 'Quote document link is required before approval.' };
    }
    return { ok: true };
  }

  function buildQuoteDocumentLink_(quoteReference, leadId, lead, pricing, quoteSnapshotId) {
    var templateUrl = getPrivateQuoteTemplateUrl_();
    var clientCurrency = String(pricing && pricing['Client Quote Currency'] || MidtsConfig.getScriptProperty('CLIENT_QUOTE_CURRENCY') || 'GBP').toUpperCase();
    var total = formatQuoteAmount_(pricing && pricing['Client Quote Amount'], clientCurrency);
    if (!templateUrl || !total) return '';

    var currency = clientCurrency;
    var validityDays = Number(MidtsConfig.getScriptProperty('QUOTE_VALIDITY_DAYS') || 30);
    if (!isFinite(validityDays) || validityDays < 1) validityDays = 30;
    var scope = String(lead && lead['Brief Requirement'] || 'Engineering support in line with the agreed project scope.')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);

    var separator = templateUrl.indexOf('?') === -1 ? '?' : '&';
    return templateUrl + separator + [
      'leadId=' + encodeURIComponent(leadId || ''),
      'quoteSnapshotId=' + encodeURIComponent(quoteSnapshotId || ''),
      'quoteReference=' + encodeURIComponent(quoteReference || ''),
      'clientName=' + encodeURIComponent(String(lead && lead['Full Name'] || 'Client')),
      'scope=' + encodeURIComponent(scope),
      'total=' + encodeURIComponent(total),
      'currency=' + encodeURIComponent(currency),
      'issued=' + encodeURIComponent(Utilities.formatDate(new Date(), 'Europe/London', 'd MMMM yyyy')),
      'validity=' + encodeURIComponent(validityDays + ' Days From Issue'),
      'vat=' + encodeURIComponent(MidtsConfig.getScriptProperty('QUOTE_VAT_TEXT') || 'Subject to VAT where applicable'),
      'status=draft'
    ].join('&');
  }

  function getPrivateQuoteTemplateUrl_() {
    var configuredTemplateUrl = String(MidtsConfig.getScriptProperty('QUOTE_TEMPLATE_URL') || '').trim();
    if (configuredTemplateUrl && !isPublicDocumentTemplateUrl_(configuredTemplateUrl)) {
      return configuredTemplateUrl;
    }

    var workspaceBaseUrl = String(MidtsConfig.getScriptProperty('WORKSPACE_BASE_URL') || '').trim().replace(/\/+$/, '');
    if (workspaceBaseUrl) {
      return workspaceBaseUrl + '/workspace/documents/quote';
    }

    var frontendBaseUrl = String(MidtsConfig.getScriptProperty('FRONTEND_BASE_URL') || '').trim().replace(/\/+$/, '');
    if (frontendBaseUrl) {
      return frontendBaseUrl + '/workspace/documents/quote';
    }

    return '/workspace/documents/quote';
  }

  function isPublicDocumentTemplateUrl_(url) {
    var value = String(url || '').trim();
    if (/\/workspace\/documents\/quote\/?(?:[?#].*)?$/i.test(value) || /\/workspace\/documents\/quote\//i.test(value)) {
      return false;
    }
    return /\/documents\/quote\/?(?:[?#].*)?$/i.test(value) || /\/documents\/quote\//i.test(value);
  }

  function withDocumentStatus_(url, status) {
    var source = String(url || '').trim();
    if (!source) return '';
    if (/[?&]status=/.test(source)) return source.replace(/([?&]status=)[^&]*/, '$1' + encodeURIComponent(status));
    return source + (source.indexOf('?') === -1 ? '?' : '&') + 'status=' + encodeURIComponent(status);
  }

  function formatQuoteAmount_(value, currency) {
    var amount = Number(String(value || '').replace(/,/g, '').trim());
    if (!isFinite(amount)) return '';
    var symbol = String(currency || 'GBP').toUpperCase() === 'GBP' ? '£' : String(currency || 'GBP').toUpperCase() + ' ';
    return symbol + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function createQuoteReference_() {
    return 'Q-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMdd-HHmmss');
  }

  function isYes_(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === 'approved';
  }

  return {
    prepareQuoteDraft: prepareQuoteDraft,
    refreshQuoteDocumentLink: refreshQuoteDocumentLink,
    approveQuoteDraft: approveQuoteDraft
  };
})();