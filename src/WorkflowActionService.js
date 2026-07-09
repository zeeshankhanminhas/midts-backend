var MidtsWorkflowActionService = (function () {
  var ACTIONS = {
    VENDOR_SAFE_READY: 'vendorSafeReady',
    APPROVE_MARGIN: 'approveMargin',
    PREPARE_QUOTE: 'prepareQuote',
    APPROVE_QUOTE: 'approveQuote',
    SEND_QUOTE: 'sendQuote'
  };

  function handleActionRequest(e) {
    var params = e && e.parameter || {};
    return htmlResponse_(
      'Workflow action moved to Workspace',
      'Legacy Apps Script workflow action links are disabled. Open MIDTS Workspace and continue from the operational queue for lead ' + String(params.leadId || '') + '.'
    );
  }

  function applyAction(leadId, actionKey, reviewer) {
    return {
      ok: false,
      code: 'LEGACY_WORKFLOW_ACTION_DISABLED',
      message: 'Legacy Apps Script workflow actions are disabled. Use MIDTS Workspace operational queues.',
      leadId: leadId,
      action: actionKey,
      reviewer: reviewer || 'Workspace'
    };
  }

  function buildActionUrl(leadId, actionKey) {
    var baseUrl = MidtsConfig.getScriptProperty('WORKSPACE_BASE_URL') || 'https://new-midts.vercel.app';
    var route = workspaceRouteForAction_(actionKey);
    return String(baseUrl || '').replace(/\/+$/, '') + route + '?leadId=' + encodeURIComponent(leadId || '');
  }

  function workspaceRouteForAction_(actionKey) {
    var action = normalizeAction_(actionKey);
    if (action === normalizeAction_(ACTIONS.VENDOR_SAFE_READY)) return '/workspace/vendor-safe/review';
    if (action === normalizeAction_(ACTIONS.APPROVE_MARGIN)) return '/workspace/margin/review';
    if (action === normalizeAction_(ACTIONS.PREPARE_QUOTE)) return '/workspace/quote-builder/review';
    if (action === normalizeAction_(ACTIONS.APPROVE_QUOTE)) return '/workspace/quote-builder/review';
    if (action === normalizeAction_(ACTIONS.SEND_QUOTE)) return '/workspace/proposal-builder/review';
    return '/workspace';
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
