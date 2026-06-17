var MidtsSheetService = (function () {
  var SHEETS = {
    LEADS: 'Leads',
    WEBHOOK_LOGS: 'Webhook Logs',
    EMAIL_LOGS: 'Email Logs'
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
    'Raw Payload JSON',
    'Lifecycle Status',
    'Review Status',
    'Qualification Decision',
    'Human Approval',
    'Reviewer',
    'Review Notes',
    'Decision Timestamp',
    'Next Action',
    'Next Action Due',
    'Capability Statement Required',
    'Capability Statement Sent',
    'Capability Statement Sent At',
    'Capability Statement Link',
    'Quote Required',
    'Quote Reference',
    'Quote Status',
    'Quote Document Link',
    'Quote Sent At',
    'Nurture Status',
    'Nurture Reason',
    'Next Nurture Date',
    'Nurture Attempts',
    'Last Nurture Email Sent At',
    'Info Request Status',
    'Missing Information Needed',
    'Final Outcome',
    'Close Reason',
    'Closed At',
    'Last Updated At'
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

  var EMAIL_LOG_HEADERS = [
    'Logged At',
    'Lead ID',
    'Submission ID',
    'Recipient Email',
    'Internal Copy Email',
    'Subject',
    'Status',
    'Message'
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
    var existingWidth = Math.max(sheet.getLastColumn(), headers.length);
    var current = sheet.getRange(1, 1, 1, existingWidth).getValues()[0];
    var populatedHeaders = current.filter(function (header) {
      return String(header || '').trim() !== '';
    });
    var needsHeaders = populatedHeaders.length === 0;

    if (needsHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }

    for (var i = 0; i < populatedHeaders.length; i += 1) {
      if (headers[i] !== populatedHeaders[i]) {
        throw new Error('Sheet header mismatch on ' + sheet.getName() + '. Expected launch schema before writing.');
      }
    }

    if (populatedHeaders.length < headers.length) {
      var missingHeaders = headers.slice(populatedHeaders.length);
      sheet.getRange(1, populatedHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
      sheet.setFrozenRows(1);
    }
  }

  function appendLeadRow(row) {
    getOrCreateSheet(SHEETS.LEADS, LEAD_HEADERS).appendRow(row);
  }

  function appendWebhookLog(row) {
    getOrCreateSheet(SHEETS.WEBHOOK_LOGS, LOG_HEADERS).appendRow(row);
  }

  function appendEmailLog(row) {
    getOrCreateSheet(SHEETS.EMAIL_LOGS, EMAIL_LOG_HEADERS).appendRow(row);
  }

  function getLeadSheet() {
    return getOrCreateSheet(SHEETS.LEADS, LEAD_HEADERS);
  }

  function getHeaderMap(sheet) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return headers.reduce(function (map, header, index) {
      if (header) map[String(header)] = index + 1;
      return map;
    }, {});
  }

  function findLeadById(leadId) {
    var sheet = getLeadSheet();
    var headerMap = getHeaderMap(sheet);
    var leadIdColumn = headerMap['Lead ID'];
    if (!leadIdColumn) throw new Error('Lead ID column missing.');

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    var values = sheet.getRange(2, leadIdColumn, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i += 1) {
      if (String(values[i][0]) === String(leadId)) {
        var rowNumber = i + 2;
        var rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
        return {
          sheet: sheet,
          rowNumber: rowNumber,
          headerMap: headerMap,
          rowValues: rowValues,
          lead: rowToObject_(rowValues, headerMap)
        };
      }
    }

    return null;
  }

  function updateLeadById(leadId, updates) {
    var result = findLeadById(leadId);
    if (!result) {
      throw new Error('Lead not found: ' + leadId);
    }

    Object.keys(updates).forEach(function (header) {
      var column = result.headerMap[header];
      if (!column) {
        throw new Error('Cannot update missing column: ' + header);
      }
      result.sheet.getRange(result.rowNumber, column).setValue(updates[header]);
    });

    return findLeadById(leadId);
  }

  function rowToObject_(rowValues, headerMap) {
    return Object.keys(headerMap).reduce(function (obj, header) {
      obj[header] = rowValues[headerMap[header] - 1];
      return obj;
    }, {});
  }

  function ensureLaunchSheets() {
    getOrCreateSheet(SHEETS.LEADS, LEAD_HEADERS);
    getOrCreateSheet(SHEETS.WEBHOOK_LOGS, LOG_HEADERS);
    getOrCreateSheet(SHEETS.EMAIL_LOGS, EMAIL_LOG_HEADERS);
    return {
      leadsSheet: SHEETS.LEADS,
      logsSheet: SHEETS.WEBHOOK_LOGS,
      emailLogsSheet: SHEETS.EMAIL_LOGS
    };
  }

  return {
    SHEETS: SHEETS,
    LEAD_HEADERS: LEAD_HEADERS,
    LOG_HEADERS: LOG_HEADERS,
    EMAIL_LOG_HEADERS: EMAIL_LOG_HEADERS,
    appendLeadRow: appendLeadRow,
    appendWebhookLog: appendWebhookLog,
    appendEmailLog: appendEmailLog,
    findLeadById: findLeadById,
    updateLeadById: updateLeadById,
    ensureLaunchSheets: ensureLaunchSheets
  };
})();
