var MidtsResponseService = (function () {
  function json(payload) {
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function success(data) {
    return json({
      ok: true,
      status: 'success',
      data: data || {}
    });
  }

  function failure(code, message, details) {
    return json({
      ok: false,
      status: 'error',
      code: code,
      message: message,
      details: details || {}
    });
  }

  return {
    json: json,
    success: success,
    failure: failure
  };
})();
