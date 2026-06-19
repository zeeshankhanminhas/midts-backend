var MidtsWorkflowActionService = (function () {
  var ACTIONS = {
    VENDOR_SAFE_READY: 'vendorSafeReady',
    APPROVE_MARGIN: 'approveMargin',
    PREPARE_QUOTE: 'prepareQuote',
    APPROVE_QUOTE: 'approveQuote'
  };

  function handleActionRequest(e) {
    try {
      var params = e && e.parameter || {};
      var validation = validateActionParams_(params);
      if (!validation.ok) {
        return htmlResponse_('MIDTS action failed', validation.message);
      }

      var result = applyAction(params.leadId, params.action, params.reviewer || 'Email Approval');
      if (!result.ok) {
        return htmlResponse_('MIDTS action blocked', result.message || result.code || 'The action could not be completed.');
      }

      var emailResult = sendNextActionEmailIfUseful_(params.leadId);
      var emailMessage = emailResult && emailResult.ok ? ' Next workflow email sent.' : '';

      return htmlResponse_(
        'MIDTS action completed',
        'Lead ' + result.leadId + ' updated. Next action: ' + (result.nextAction || 'Review next workflow step') + '. Status: ' + (result.lifecycleStatus || result.quoteStatus || 'Updated') + '.' + emailMessage
      );
    } catch (error) {
      return htmlResponse_('MIDTS action failed', String(error && error.message ? error.message : error));
    }
  }

  function applyAction(leadId, actionKey, reviewer) {
    var action = normalizeAction_(actionKey);
    if (action === normalizeAction_(ACTIONS.VENDOR_SAFE_READY)) {
      return MidtsVendorPricingService.markVendorSafePackageReady(leadId, reviewer || 'Email Approval');
    }
    if (action === normalizeAction_(ACTIONS.APPROVE_MARGIN)) {
      return MidtsVendorPricingService.approveLatestMargin(leadId, reviewer || 'Email Approval');
    }
    if (action === normalizeAction_(ACTIONS.PREPARE_QUOTE)) {
      return MidtsQuoteService.prepareQuoteDraft(leadId, reviewer || 'Email Approval');
    }
    if (action === normalizeAction_(ACTIONS.APPROVE_QUOTE)) {
      return MidtsQuoteService.approveQuoteDraft(leadId, reviewer || 'Email Approval');
    }

    return { ok: false, code: 'UNSUPPORTED_ACTION', message: 'Unsupported action: ' + actionKey };
  }

  function buildActionUrl(leadId, actionKey) {
    var baseUrl = MidtsConfig.getWebAppUrl();
    var separator = baseUrl.indexOf('?') === -1 ? '?' : '&';
    return baseUrl + separator + [
      'action=' + encodeURIComponent(actionKey),
      'leadId=' + encodeURIComponent(leadId),
      'token=' + encodeURIComponent(MidtsConfig.getDecisionToken())
    ].join('&');
  }

  function sendNextActionEmailIfUseful_(leadId) {
    try {
      var leadResult = MidtsSheetService.findLeadById(leadId);
      if (!leadResult) return { ok: false, status: 'skipped', message: 'Lead not found.' };

      var lifecycleStatus = String(leadResult.lead['Lifecycle Status'] || '');
      var quoteStatus = String(leadResult.lead['Quote Status'] || '');

      if (lifecycleStatus === 'Vendor Pricing' || quoteStatus === 'Waiting Vendor Price') {
        return MidtsVendorRequestService.sendRequestSetupEmail(leadId);
      }
      if (lifecycleStatus === 'Quote Approved' || quoteStatus === 'Approved to Send') {
        return { ok: false, status: 'skipped', message: 'No further approval link required.' };
      }

      return MidtsEmailService.sendWorkflowActionEmailForLead(leadId);
    } catch (error) {
      return { ok: false, status: 'failed', message: String(error && error.message ? error.message : error) };
    }
  }

  function validateActionParams_(params) {
    if (!params.leadId) {
      return { ok: false, message: 'Missing leadId.' };
    }
    if (!params.action) {
      return { ok: false, message: 'Missing action.' };
    }
    if (!params.token) {
      return { ok: false, message: 'Missing action token.' };
    }
    if (String(params.token) !== MidtsConfig.getDecisionToken()) {
      return { ok: false, message: 'Invalid action token.' };
    }
    if (!isSupportedAction_(params.action)) {
      return { ok: false, message: 'Unsupported action: ' + params.action };
    }
    return { ok: true };
  }

  function isSupportedAction_(actionKey) {
    var action = normalizeAction_(actionKey);
    return action === normalizeAction_(ACTIONS.VENDOR_SAFE_READY) ||
      action === normalizeAction_(ACTIONS.APPROVE_MARGIN) ||
      action === normalizeAction_(ACTIONS.PREPARE_QUOTE) ||
      action === normalizeAction_(ACTIONS.APPROVE_QUOTE);
  }

  function normalizeAction_(actionKey) {
    return String(actionKey || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  }

  function htmlResponse_(title, message) {
    return HtmlService.createHtmlOutput([
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>' + escapeHtml_(title) + '</title></head>',
      '<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;padding:32px;max-width:760px;margin:0 auto">',
      '<h1 style="font-size:24px;margin:0 0 16px">' + escapeHtml_(title) + '</h1>',
      '<p style="font-size:16px;margin:0">' + escapeHtml_(message) + '</p>',
      '</body></html>'
    ].join(''));
  }

  function escapeHtml_(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    ACTIONS: ACTIONS,
    applyAction: applyAction,
    buildActionUrl: buildActionUrl,
    handleActionRequest: handleActionRequest
  };
})();
