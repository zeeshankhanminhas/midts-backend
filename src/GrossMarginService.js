var MidtsGrossMarginService = (function () {
  function save(payload) { return apply_(payload, false); }
  function approve(payload) { return apply_(payload, true); }

  function apply_(payload, shouldApprove) {
    payload = payload || {};
    var leadId = clean_(payload.leadId || payload.lead_id);
    var reviewer = clean_(payload.reviewer || payload.actor) || 'MIDTS Margin Reviewer';
    var marginValue = number_(payload.marginValue || payload.margin_value);
    var reason = clean_(payload.marginReason || payload.margin_reason || payload.internalNotes || payload.notes);
    if (!leadId) return fail_('MISSING_LEAD_ID', 'Lead ID is required.');
    if (marginValue === null || marginValue < 0 || marginValue >= 100) return fail_('INVALID_GROSS_MARGIN', 'Gross margin must be numeric and between 0 and 99.99%.');
    if (marginValue !== 30 && !reason) return fail_('MARGIN_REASON_REQUIRED', 'Override reason is required when gross margin is not the standard 30%.');

    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return fail_('LEAD_NOT_FOUND', 'Lead not found: ' + leadId);
    var lead = leadResult.lead;
    if (clean_(lead['Lifecycle Status']) !== 'Margin Review' || clean_(lead['Quote Status']) !== 'Margin Review Required' || clean_(lead['Vendor Pricing Status']) !== 'Pricing Received') {
      return fail_('LEAD_NOT_IN_MARGIN_REVIEW', 'Lead must be in Margin Review with vendor pricing received.');
    }

    var pricingResult = MidtsSheetService.findLatestVendorPricingByLeadId(leadId);
    if (!pricingResult) return fail_('VENDOR_PRICING_NOT_FOUND', 'Latest vendor pricing was not found.');
    var pricing = pricingResult.pricing;
    if (clean_(pricing['Pricing Status']) !== 'Margin Review Required' || yes_(pricing['Pricing Approved'])) return fail_('PRICING_NOT_APPROVABLE', 'Latest pricing is not available for margin review.');

    var vendorCost = number_(pricing['Vendor Cost']);
    if (vendorCost === null || vendorCost < 0) return fail_('VENDOR_COST_MISSING', 'A valid vendor cost is required.');
    var vendorCurrency = clean_(pricing['Vendor Currency']).toUpperCase();
    var clientCurrency = clean_(pricing['Client Quote Currency'] || vendorCurrency).toUpperCase();
    if (vendorCurrency && clientCurrency && vendorCurrency !== clientCurrency) return fail_('CURRENCY_CONVERSION_REQUIRED', 'Vendor and client currencies must match until currency conversion is implemented.');
    var quoteReference = clean_(pricing['Quote Reference'] || lead['Quote Reference']);
    if (!quoteReference) return fail_('QUOTE_REFERENCE_MISSING', 'Quote reference is required before margin approval.');

    var clientQuote = round_(vendorCost / (1 - marginValue / 100));
    var profit = round_(clientQuote - vendorCost);
    var now = new Date();
    var note = '[' + Utilities.formatDate(now, 'Europe/London', 'yyyy-MM-dd HH:mm') + '] Gross margin ' + marginValue + '% ' + (shouldApprove ? 'approved' : 'saved') + ' by ' + reviewer + (reason ? ': ' + reason : '');
    var notes = append_(pricing['Notes'], note);

    var pricingUpdates = {
      'Margin Type': 'gross-margin-percentage',
      'Margin Value': marginValue,
      'MIDTS Profit Amount': profit,
      'Client Quote Amount': clientQuote,
      'Client Quote Currency': clientCurrency || vendorCurrency || 'GBP',
      'Pricing Status': shouldApprove ? 'Margin Approved' : 'Margin Review Required',
      'Pricing Approved': shouldApprove ? 'Yes' : 'No',
      'Pricing Approved By': shouldApprove ? reviewer : '',
      'Pricing Approved At': shouldApprove ? now : '',
      'Revision Reason': append_(pricing['Revision Reason'], note),
      'Notes': notes,
      'Last Updated At': now
    };
    MidtsSheetService.updateVendorPricingByPricingId(pricing['Pricing ID'], pricingUpdates);

    var leadUpdates = shouldApprove ? {
      'Lifecycle Status': 'Quote Preparation',
      'Next Action': 'Prepare quote',
      'Next Action Due': now,
      'Quote Required': 'Yes',
      'Quote Reference': quoteReference,
      'Quote Status': 'Ready for Quote Draft',
      'Vendor Pricing Required': 'Yes',
      'Vendor Pricing Status': 'Margin Approved',
      'Reviewer': reviewer,
      'Review Notes': append_(lead['Review Notes'], note),
      'Last Updated At': now
    } : {
      'Lifecycle Status': 'Margin Review',
      'Next Action': 'Approve margin',
      'Next Action Due': now,
      'Quote Status': 'Margin Review Required',
      'Vendor Pricing Status': 'Pricing Received',
      'Reviewer': reviewer,
      'Review Notes': append_(lead['Review Notes'], note),
      'Last Updated At': now
    };
    MidtsSheetService.updateLeadById(leadId, leadUpdates);

    return {
      ok: true,
      leadId: leadId,
      pricingId: pricing['Pricing ID'],
      quoteReference: quoteReference,
      marginType: 'gross-margin-percentage',
      marginValue: marginValue,
      vendorCost: vendorCost,
      vendorCurrency: vendorCurrency,
      midtsProfitAmount: profit,
      clientQuoteAmount: clientQuote,
      clientQuoteCurrency: clientCurrency || vendorCurrency || 'GBP',
      pricingStatus: shouldApprove ? 'Margin Approved' : 'Margin Review Required',
      pricingApproved: shouldApprove ? 'Yes' : 'No',
      quoteStatus: shouldApprove ? 'Ready for Quote Draft' : 'Margin Review Required',
      lifecycleStatus: shouldApprove ? 'Quote Preparation' : 'Margin Review',
      vendorPricingStatus: shouldApprove ? 'Margin Approved' : 'Pricing Received',
      nextAction: shouldApprove ? 'Prepare quote' : 'Approve margin'
    };
  }

  function append_(current, line) { var value = clean_(current); return value ? value + '\n' + line : line; }
  function number_(value) { if (value === '' || value === null || value === undefined) return null; var parsed = Number(String(value).replace(/,/g, '').trim()); return isFinite(parsed) ? parsed : null; }
  function round_(value) { return Math.round(Number(value) * 100) / 100; }
  function yes_(value) { var text = clean_(value).toLowerCase(); return text === 'yes' || text === 'true' || text === 'approved'; }
  function clean_(value) { return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function fail_(code, message) { return { ok:false, code:code, message:message }; }
  return { save:save, approve:approve };
})();
