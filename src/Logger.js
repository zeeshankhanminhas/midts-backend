var MidtsLogger = (function () {
  function safeJson(value) {
    try {
      return JSON.stringify(value || {});
    } catch (error) {
      return JSON.stringify({ serializationError: String(error && error.message ? error.message : error) });
    }
  }

  function logWebhookAttempt(entry) {
    entry = entry || {};
    MidtsSheetService.appendWebhookLog([
      new Date(),
      entry.requestId || '',
      entry.outcome || '',
      entry.message || '',
      entry.submissionId || '',
      entry.email || '',
      entry.source || '',
      safeJson(entry.payload || {})
    ]);
  }

  return {
    logWebhookAttempt: logWebhookAttempt,
    safeJson: safeJson
  };
})();
