var MidtsConfig = (function () {
  var KEYS = {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    WEBSITE_WEBHOOK_TOKEN: 'WEBSITE_WEBHOOK_TOKEN'
  };

  function getScriptProperty(key) {
    var value = PropertiesService.getScriptProperties().getProperty(key);
    return value ? String(value).trim() : '';
  }

  function getRequiredScriptProperty(key) {
    var value = getScriptProperty(key);
    if (!value) {
      throw new Error('Missing required Script Property: ' + key);
    }
    return value;
  }

  function getSpreadsheetId() {
    return getScriptProperty(KEYS.SPREADSHEET_ID);
  }

  function getWebhookToken() {
    return getRequiredScriptProperty(KEYS.WEBSITE_WEBHOOK_TOKEN);
  }

  return {
    KEYS: KEYS,
    getScriptProperty: getScriptProperty,
    getRequiredScriptProperty: getRequiredScriptProperty,
    getSpreadsheetId: getSpreadsheetId,
    getWebhookToken: getWebhookToken
  };
})();
