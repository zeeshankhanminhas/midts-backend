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
    var quoteDocumentLink = buildQuoteDocumentLink_(quoteReference, leadId);
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
      clientQuoteAmount: latestPricing.pricing['Client Quote Amount'] || ''
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

  function buildQuoteDocumentLink_(quoteReference, leadId) {
    var templateUrl = MidtsConfig.getScriptProperty('QUOTE_TEMPLATE_URL');
    if (!templateUrl) return '';

    var separator = templateUrl.indexOf('?') === -1 ? '?' : '&';
    return templateUrl + separator + [
      'quoteReference=' + encodeURIComponent(quoteReference || ''),
      'leadId=' + encodeURIComponent(leadId || '')
    ].join('&');
  }

  function createQuoteReference_() {
    return 'Q-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyyMMdd-HHmmss');
  }

  function isYes_(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === 'approved';
  }

  return {
    prepareQuoteDraft: prepareQuoteDraft
  };
})();
