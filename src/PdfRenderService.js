var MidtsPdfRenderService = (function () {
  function renderApprovedQuotePdf(leadId, quoteReference, sourceUrl) {
    if (!leadId || !quoteReference || !sourceUrl) {
      return { ok: false, message: 'Lead ID, quote reference, and quote source URL are required.' };
    }

    var rendererUrl;
    var rendererToken;
    try {
      rendererUrl = MidtsConfig.getRequiredScriptProperty('PDF_RENDERER_URL');
      rendererToken = MidtsConfig.getRequiredScriptProperty('PDF_RENDERER_TOKEN');
    } catch (error) {
      return { ok: false, message: 'PDF renderer is not configured: ' + errorMessage_(error) };
    }

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

    var blob = response.getBlob();
    var contentType = String(blob.getContentType() || '').toLowerCase();
    var bytes = blob.getBytes();
    if (!bytes || bytes.length < 100) {
      return { ok: false, message: 'PDF renderer returned an empty or invalid PDF payload.' };
    }
    if (contentType.indexOf('text/html') !== -1) {
      return { ok: false, message: 'PDF renderer returned HTML instead of a PDF. Check the signed quote render URL and Workspace auth configuration.' };
    }

    var fileName = safeFileName_(quoteReference) + '_Approved.pdf';
    var file;
    try {
      file = MidtsDriveService.getQuotesFolder(leadId)
        .createFile(blob.setName(fileName));
    } catch (error) {
      return { ok: false, message: 'Approved quote PDF could not be stored in Drive: ' + errorMessage_(error) };
    }

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
