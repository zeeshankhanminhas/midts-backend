var MidtsTokenService = (function () {
  var TOKEN_FIELDS = [
    'webhookToken',
    'webhook_token',
    'formToken',
    'token',
    'WEBSITE_WEBHOOK_TOKEN'
  ];

  function extractToken(payload) {
    payload = payload || {};
    for (var i = 0; i < TOKEN_FIELDS.length; i += 1) {
      var key = TOKEN_FIELDS[i];
      if (payload[key]) {
        return String(payload[key]).trim();
      }
    }
    return '';
  }

  function validate(payload) {
    var expected = MidtsConfig.getWebhookToken();
    var received = extractToken(payload);

    if (!received) {
      return {
        ok: false,
        code: 'TOKEN_MISSING',
        message: 'Webhook token was not supplied.'
      };
    }

    if (received !== expected) {
      return {
        ok: false,
        code: 'TOKEN_INVALID',
        message: 'Webhook token did not match.'
      };
    }

    return {
      ok: true
    };
  }

  return {
    extractToken: extractToken,
    validate: validate
  };
})();
