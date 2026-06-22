var MidtsPdfRenderService = (function () {
  function renderApprovedQuotePdf(leadId, quoteReference, sourceUrl) {
    if (!leadId || !quoteReference || !sourceUrl) {
      return { ok: false, message: 'Lead ID, quote reference, and quote source URL are required.' };
    }

    var rendererUrl = MidtsConfig.getRequiredScriptProperty('PDF_RENDERER_URL');
    var rendererToken = MidtsConfig.getRequiredScriptProperty('PDF_RENDERER_TOKEN');
    var response;

    try {
      response = UrlFetchApp.fetch(rendererUrl, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + rendererToken },
        payload: JSON.stringify({ url: sourceUrl }),
        muteHttpExceptions: true
      });
    } catch (error) {
      return { ok: false, message: 'PDF renderer could not be reached: ' + errorMessage_(error) };
    }

    if (response.getResponseCode() !== 200) {
      return {
        ok: false,
        message: 'PDF renderer failed with HTTP ' + response.getResponseCode() + ': ' + response.getContentText().slice(0, 300)
      };
    }

    var fileName = safeFileName_(quoteReference) + '_Approved.pdf';
    var file = MidtsDriveService.getQuotesFolder(leadId)
      .createFile(response.getBlob().setName(fileName));

    return {
      ok: true,
      driveFileId: file.getId(),
      driveUrl: file.getUrl(),
      fileName: fileName
    };
  }

  function safeFileName_(value) {
    return String(value || 'MIDTS_Quote').replace(/[^A-Za-z0-9._-]/g, '_');
  }

  function errorMessage_(error) {
    return String(error && error.message ? error.message : error);
  }

  return {
    renderApprovedQuotePdf: renderApprovedQuotePdf
  };
})();
