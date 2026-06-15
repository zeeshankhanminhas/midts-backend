var MidtsSheetService = (function () {
  var SHEETS = {
    LEADS: 'Leads',
    WEBHOOK_LOGS: 'Webhook Logs'
  };

  var LEAD_HEADERS = [
    'Lead ID',
    'Created At',
    'Submission ID',
    'Full Name',
    'Email',
    'Company',
    'Project Type',
    'Brief Requirement',
    'Source',
    'Page URL',
    'Status',
    'Raw Payload JSON'
  ];

  var LOG_HEADERS = [
    'Logged At',
    'Request ID',
    'Outcome',
    'Message',
    'Submission ID',
    'Email',
    'Source',
    'Payload JSON'
  ];

  function getSpreadsheet() {
    var spreadsheetId = MidtsConfig.getSpreadsheetId();
    if (spreadsheetId) {
      return SpreadsheetApp.openById(spreadsheetId);
    }
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) {
      throw new Error('No SPREADSHEET_ID property and no active spreadsheet available.');
    }
    return active;
  }

  function getOrCreateSheet(name, headers) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    ensureHeaders(sheet, headers);
    return sheet;
  }

  function ensureHeaders(sheet, headers) {
    var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var needsHeaders = current.join('').trim() === '';

    if (needsHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }

    var mismatch = headers.some(function (header, index) {
      return current[index] !== header;
    });

    if (mismatch) {
      throw new Error('Sheet header mismatch on ' + sheet.getName() + '. Expected launch schema before writing.');
    }
  }

  function appendLeadRow(row) {
    getOrCreateSheet(SHEETS.LEADS, LEAD_HEADERS).appendRow(row);
  }

  function appendWebhookLog(row) {
    getOrCreateSheet(SHEETS.WEBHOOK_LOGS, LOG_HEADERS).appendRow(row);
  }

  function ensureLaunchSheets() {
    getOrCreateSheet(SHEETS.LEADS, LEAD_HEADERS);
    getOrCreateSheet(SHEETS.WEBHOOK_LOGS, LOG_HEADERS);
    return {
      leadsSheet: SHEETS.LEADS,
      logsSheet: SHEETS.WEBHOOK_LOGS
    };
  }

  return {
    SHEETS: SHEETS,
    LEAD_HEADERS: LEAD_HEADERS,
    LOG_HEADERS: LOG_HEADERS,
    appendLeadRow: appendLeadRow,
    appendWebhookLog: appendWebhookLog,
    ensureLaunchSheets: ensureLaunchSheets
  };
})();
