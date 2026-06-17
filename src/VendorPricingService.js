var MidtsVendorPricingService = (function () {
  function markVendorSafePackageReady(leadId, reviewer) {
    if (!leadId) {
      return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required.' };
    }

    var existingLead = MidtsSheetService.findLeadById(leadId);
    if (!existingLead) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    }

    if (!isYes_(existingLead.lead['Vendor Safe Package Required'])) {
      return { ok: false, code: 'VENDOR_SAFE_PACKAGE_NOT_REQUIRED', message: 'Vendor-safe package is not required for this lead.' };
    }

    var now = new Date();
    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Lifecycle Status': 'Vendor Pricing',
      'Next Action': 'Contact vendor',
      'Next Action Due': now,
      'Quote Status': 'Waiting Vendor Price',
      'Vendor Safe Package Ready': 'Yes',
      'Drive Folder Status': 'Manual vendor-safe package ready',
      'Vendor Pricing Required': 'Yes',
      'Vendor Pricing Status': 'Contact Vendor',
      'Reviewer': reviewer || existingLead.lead['Reviewer'] || 'Vendor Safe Review',
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'VENDOR-SAFE-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'vendor_safe_package_ready',
      message: 'Vendor-safe package marked ready; lead moved to vendor pricing',
      payload: {
        leadId: leadId,
        reviewer: reviewer || 'Vendor Safe Review'
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Vendor Pricing Service'
    });

    return {
      ok: true,
      leadId: leadId,
      lifecycleStatus: 'Vendor Pricing',
      vendorSafePackageReady: 'Yes',
      vendorPricingStatus: 'Contact Vendor',
      nextAction: 'Contact vendor'
    };
  }

  function recordVendorPricing(payload) {
    var normalized = normalizePricingPayload_(payload || {});
    if (!normalized.leadId) {
      return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required for vendor pricing.' };
    }
    if (normalized.vendorCost === null) {
      return { ok: false, code: 'MISSING_VENDOR_COST', message: 'Vendor cost is required for vendor pricing.' };
    }

    var existingLead = MidtsSheetService.findLeadById(normalized.leadId);
    if (!existingLead) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + normalized.leadId };
    }

    var guardResult = guardLeadReadyForPricing_(existingLead.lead);
    if (!guardResult.ok) return guardResult;

    var now = new Date();
    var quoteReference = existingLead.lead['Quote Reference'] || createQuoteReference_(now);
    var revision = nextRevisionForLead_(normalized.leadId);
    var calculated = calculateClientPrice_(normalized.vendorCost, normalized.marginType, normalized.marginValue);
    var pricingId = 'VP-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);

    MidtsSheetService.appendVendorPricingRow([
      pricingId,
      normalized.leadId,
      quoteReference,
      now,
      normalized.vendorName,
      normalized.vendorEmail,
      normalized.vendorCost,
      normalized.vendorCurrency,
      calculated.marginType,
      calculated.marginValue,
      calculated.midtsProfitAmount,
      calculated.clientQuoteAmount,
      'Margin Review Required',
      'No',
      '',
      '',
      revision,
      'Yes',
      normalized.revisionReason,
      normalized.notes,
      now
    ]);

    var updatedLead = MidtsSheetService.updateLeadById(normalized.leadId, {
      'Lifecycle Status': 'Margin Review',
      'Next Action': 'Approve margin',
      'Next Action Due': now,
      'Quote Required': 'Yes',
      'Quote Reference': quoteReference,
      'Quote Status': 'Margin Review Required',
      'Vendor Pricing Required': 'Yes',
      'Vendor Pricing Status': 'Pricing Received',
      'Last Updated At': now
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'VENDOR-PRICING-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'vendor_pricing_recorded',
      message: 'Vendor pricing recorded; margin review required',
      payload: {
        pricingId: pricingId,
        leadId: normalized.leadId,
        quoteReference: quoteReference,
        vendorCost: normalized.vendorCost,
        vendorCurrency: normalized.vendorCurrency,
        marginType: calculated.marginType,
        marginValue: calculated.marginValue,
        clientQuoteAmount: calculated.clientQuoteAmount,
        revision: revision
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Vendor Pricing Service'
    });

    return {
      ok: true,
      pricingId: pricingId,
      leadId: normalized.leadId,
      quoteReference: quoteReference,
      vendorCost: normalized.vendorCost,
      vendorCurrency: normalized.vendorCurrency,
      marginType: calculated.marginType,
      marginValue: calculated.marginValue,
      midtsProfitAmount: calculated.midtsProfitAmount,
      clientQuoteAmount: calculated.clientQuoteAmount,
      pricingStatus: 'Margin Review Required',
      quoteStatus: 'Margin Review Required',
      nextAction: 'Approve margin',
      revision: revision
    };
  }

  function guardLeadReadyForPricing_(lead) {
    if (!isYes_(lead['Vendor Pricing Required'])) {
      return { ok: false, code: 'VENDOR_PRICING_NOT_REQUIRED', message: 'Lead is not currently marked for vendor pricing.' };
    }

    if (isYes_(lead['Vendor Safe Package Required']) && !isYes_(lead['Vendor Safe Package Ready'])) {
      return { ok: false, code: 'VENDOR_SAFE_PACKAGE_NOT_READY', message: 'Vendor-safe package must be ready before vendor pricing is recorded.' };
    }

    var lifecycle = String(lead['Lifecycle Status'] || '').trim();
    if (lifecycle !== 'Vendor Pricing' && lifecycle !== 'Margin Review') {
      return { ok: false, code: 'LEAD_NOT_IN_VENDOR_PRICING', message: 'Lead lifecycle must be Vendor Pricing before recording vendor pricing.' };
    }

    return { ok: true };
  }

  function normalizePricingPayload_(payload) {
    return {
      leadId: payload.leadId || payload.lead_id || '',
      vendorName: payload.vendorName || payload.vendor_name || '',
      vendorEmail: payload.vendorEmail || payload.vendor_email || '',
      vendorCost: parseMoney_(payload.vendorCost || payload.vendor_cost),
      vendorCurrency: payload.vendorCurrency || payload.vendor_currency || 'GBP',
      marginType: payload.marginType || payload.margin_type || getDefaultMarginType_(),
      marginValue: parseMoney_(payload.marginValue || payload.margin_value || getDefaultMarginValue_()),
      revisionReason: payload.revisionReason || payload.revision_reason || 'Initial vendor pricing',
      notes: payload.notes || ''
    };
  }

  function calculateClientPrice_(vendorCost, marginType, marginValue) {
    var safeMarginType = String(marginType || 'percentage').trim().toLowerCase();
    var safeMarginValue = marginValue === null ? getDefaultMarginValue_() : marginValue;
    var profitAmount = safeMarginType === 'fixed'
      ? safeMarginValue
      : vendorCost * (safeMarginValue / 100);
    var clientQuoteAmount = vendorCost + profitAmount;

    return {
      marginType: safeMarginType === 'fixed' ? 'fixed' : 'percentage',
      marginValue: roundMoney_(safeMarginValue),
      midtsProfitAmount: roundMoney_(profitAmount),
      clientQuoteAmount: roundMoney_(clientQuoteAmount)
    };
  }

  function nextRevisionForLead_(leadId) {
    var existing = MidtsSheetService.findLatestVendorPricingByLeadId(leadId);
    if (!existing) return 1;

    var previousRevision = Number(existing.pricing['Quote Revision'] || 1);
    if (!isFinite(previousRevision) || previousRevision < 1) previousRevision = 1;

    MidtsSheetService.updateVendorPricingByPricingId(existing.pricing['Pricing ID'], {
      'Latest Revision': 'No',
      'Last Updated At': new Date()
    });

    return previousRevision + 1;
  }

  function createQuoteReference_(date) {
    return 'Q-' + Utilities.formatDate(date || new Date(), 'Europe/London', 'yyyyMMdd-HHmmss');
  }

  function getDefaultMarginType_() {
    return MidtsConfig.getScriptProperty('DEFAULT_MARGIN_TYPE') || 'percentage';
  }

  function getDefaultMarginValue_() {
    var configured = parseMoney_(MidtsConfig.getScriptProperty('DEFAULT_MARGIN_VALUE'));
    return configured === null ? 25 : configured;
  }

  function parseMoney_(value) {
    if (value === null || value === undefined || value === '') return null;
    var parsed = Number(String(value).replace(/,/g, '').trim());
    return isFinite(parsed) ? parsed : null;
  }

  function roundMoney_(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function isYes_(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === 'required';
  }

  return {
    markVendorSafePackageReady: markVendorSafePackageReady,
    recordVendorPricing: recordVendorPricing,
    calculateClientPrice: calculateClientPrice_
  };
})();
