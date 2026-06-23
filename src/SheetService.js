var MidtsSheetService = (function () {
  var SHEETS = {
    LEADS: 'Leads',
    TECHNICAL_INTAKE: 'Technical Intake',
    TECHNICAL_REVIEWS: 'Technical Reviews',
    VENDOR_SAFE_PACKAGES: 'Vendor Safe Packages',
    PROJECTS: 'Projects',
    DELIVERY_RECORDS: 'Delivery Records',
    VENDOR_PRICING: 'Vendor Pricing',
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
    'Last Updated At',
    'Step 2 Status',
    'Step 2 Completed At',
    'Files Provided',
    'NDA Required',
    'Vendor Safe Package Required',
    'Vendor Safe Package Ready',
    'Drive Folder Status',
    'Vendor Pricing Required',
    'Vendor Pricing Status'
  ];

  var TECHNICAL_INTAKE_HEADERS = [
    'Technical Intake ID',
    'Lead ID',
    'Submission ID',
    'Completed At',
    'Service Type',
    'Technical Scope',
    'Materials',
    'Quantity',
    'Deadline',
    'Files Provided',
    'File Links',
    'NDA Required',
    'Confidentiality Notes',
    'Vendor Safe Package Required',
    'Vendor Safe Package Ready',
    'Budget Range',
    'Timing Notes',
    'Technical Notes',
    'Raw Payload JSON'
  ];

  var TECHNICAL_REVIEW_HEADERS = [
    'Technical Review ID',
    'Lead ID',
    'Technical Intake ID',
    'Created At',
    'Reviewer',
    'Review Status',
    'Review Summary',
    'File Review',
    'Risks',
    'Clarifications',
    'Recommendation',
    'Approved At',
    'Last Updated At'
  ];

  var VENDOR_SAFE_PACKAGE_HEADERS = [
    'Package ID', 'Lead ID', 'Technical Review ID', 'Created At', 'Created By',
    'Package Status', 'Drive Folder URL', 'Package JSON', 'Package Hash',
    'Approved At', 'Last Updated At'
  ];

  var PROJECT_HEADERS = [
    'Project ID', 'Lead ID', 'Quote Reference', 'Created At', 'Created By',
    'Project Status', 'Drive Folder URL', 'Source Document ID', 'Last Updated At'
  ];

  var DELIVERY_RECORD_HEADERS = [
    'Delivery Record ID', 'Project ID', 'Lead ID', 'Quote Reference', 'Created At',
    'Created By', 'Delivery Status', 'Delivery Summary', 'Delivered Files',
    'Client Review Status', 'Completed At', 'Last Updated At'
  ];

  var VENDOR_PRICING_HEADERS = [
    'Pricing ID',
    'Lead ID',
    'Quote Reference',
    'Created At',
    'Vendor Name',
    'Vendor Email',
    'Vendor Cost',
    'Vendor Currency',
    'Margin Type',
    'Margin Value',
    'MIDTS Profit Amount',
    'Client Quote Amount',
    'Pricing Status',
    'Pricing Approved',
    'Pricing Approved By',
    'Pricing Approved At',
    'Quote Revision',
    'Latest Revision',
    'Revision Reason',
    'Notes',
    'Last Updated At',
    'Client Quote Currency'
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

  function ensureHeaders(sheet, expectedHeaders) {
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      sheet.setFrozenRows(1);
      return;
    }

    var headerMap = getHeaderMap(sheet);
    var missingHeaders = expectedHeaders.filter(function (header) {
      return !headerMap[header];
    });

    if (missingHeaders.length) {
      var startColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, startColumn, 1, missingHeaders.length).setValues([missingHeaders]);
    }

    sheet.setFrozenRows(1);
  }

  function appendLeadRow(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.LEADS, LEAD_HEADERS), LEAD_HEADERS, row);
    refreshPipelineSafely_();
  }

  function appendTechnicalIntakeRow(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.TECHNICAL_INTAKE, TECHNICAL_INTAKE_HEADERS), TECHNICAL_INTAKE_HEADERS, row);
  }

  function appendDeliveryRecordRow(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.DELIVERY_RECORDS, DELIVERY_RECORD_HEADERS), DELIVERY_RECORD_HEADERS, row);
  }

  function appendVendorPricingRow(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.VENDOR_PRICING, VENDOR_PRICING_HEADERS), VENDOR_PRICING_HEADERS, row);
  }

  function appendProjectRow(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.PROJECTS, PROJECT_HEADERS), PROJECT_HEADERS, row);
  }

  function appendVendorSafePackageRow(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.VENDOR_SAFE_PACKAGES, VENDOR_SAFE_PACKAGE_HEADERS), VENDOR_SAFE_PACKAGE_HEADERS, row);
  }

  function appendTechnicalReviewRow(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.TECHNICAL_REVIEWS, TECHNICAL_REVIEW_HEADERS), TECHNICAL_REVIEW_HEADERS, row);
  }

  function appendWebhookLog(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.WEBHOOK_LOGS, LOG_HEADERS), LOG_HEADERS, row);
  }

  function appendEmailLog(row) {
    appendRowByHeaders_(getOrCreateSheet(SHEETS.EMAIL_LOGS, EMAIL_LOG_HEADERS), EMAIL_LOG_HEADERS, row);
  }

  function appendRowByHeaders_(sheet, expectedHeaders, sourceRow) {
    ensureHeaders(sheet, expectedHeaders);
    var headerMap = getHeaderMap(sheet);
    var row = createBlankRow_(sheet.getLastColumn());

    expectedHeaders.forEach(function (header, index) {
      var column = headerMap[header];
      if (column) row[column - 1] = sourceRow[index] === undefined ? '' : sourceRow[index];
    });

    sheet.appendRow(row);
  }

  function getLeadSheet() {
    return getOrCreateSheet(SHEETS.LEADS, LEAD_HEADERS);
  }

  function getDeliveryRecordSheet() {
    return getOrCreateSheet(SHEETS.DELIVERY_RECORDS, DELIVERY_RECORD_HEADERS);
  }

  function getVendorPricingSheet() {
    return getOrCreateSheet(SHEETS.VENDOR_PRICING, VENDOR_PRICING_HEADERS);
  }

  function getTechnicalIntakeSheet() {
    return getOrCreateSheet(SHEETS.TECHNICAL_INTAKE, TECHNICAL_INTAKE_HEADERS);
  }

  function getTechnicalReviewSheet() {
    return getOrCreateSheet(SHEETS.TECHNICAL_REVIEWS, TECHNICAL_REVIEW_HEADERS);
  }

  function getVendorSafePackageSheet() {
    return getOrCreateSheet(SHEETS.VENDOR_SAFE_PACKAGES, VENDOR_SAFE_PACKAGE_HEADERS);
  }

  function getProjectSheet() {
    return getOrCreateSheet(SHEETS.PROJECTS, PROJECT_HEADERS);
  }

  function getHeaderMap(sheet) {
    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    return headers.reduce(function (map, header, index) {
      var normalized = String(header || '').trim();
      if (normalized && !map[normalized]) map[normalized] = index + 1;
      return map;
    }, {});
  }

  function findLeadById(leadId) {
    return findLeadByColumnValue_('Lead ID', leadId);
  }

  function findLeadBySubmissionId(submissionId) {
    if (!submissionId) return null;
    return findLeadByColumnValue_('Submission ID', submissionId);
  }

  function findLeadByColumnValue_(columnName, value) {
    var sheet = getLeadSheet();
    var headerMap = getHeaderMap(sheet);
    var targetColumn = headerMap[columnName];
    if (!targetColumn) throw new Error(columnName + ' column missing.');

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    var values = sheet.getRange(2, targetColumn, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i += 1) {
      if (String(values[i][0]) === String(value)) {
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

  function findVendorPricingByLeadId(leadId) {
    return findVendorPricingByColumnValue_('Lead ID', leadId);
  }

  function findLatestTechnicalIntakeByLeadId(leadId) {
    var sheet = getTechnicalIntakeSheet();
    var headerMap = getHeaderMap(sheet);
    var leadColumn = headerMap['Lead ID'];
    if (!leadColumn || sheet.getLastRow() < 2) return null;

    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var index = rows.length - 1; index >= 0; index -= 1) {
      if (String(rows[index][leadColumn - 1]) === String(leadId)) {
        return {
          sheet: sheet,
          rowNumber: index + 2,
          headerMap: headerMap,
          intake: rowToObject_(rows[index], headerMap)
        };
      }
    }
    return null;
  }

  function findLatestTechnicalReviewByLeadId(leadId) {
    var sheet = getTechnicalReviewSheet();
    var headerMap = getHeaderMap(sheet);
    var leadColumn = headerMap['Lead ID'];
    if (!leadColumn || sheet.getLastRow() < 2) return null;

    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var index = rows.length - 1; index >= 0; index -= 1) {
      if (String(rows[index][leadColumn - 1]) === String(leadId)) {
        return {
          sheet: sheet,
          rowNumber: index + 2,
          headerMap: headerMap,
          review: rowToObject_(rows[index], headerMap)
        };
      }
    }
    return null;
  }

  function findLatestVendorSafePackageByLeadId(leadId) {
    var sheet = getVendorSafePackageSheet();
    var headers = getHeaderMap(sheet);
    var leadColumn = headers['Lead ID'];
    if (!leadColumn || sheet.getLastRow() < 2) return null;
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var index = rows.length - 1; index >= 0; index -= 1) {
      if (String(rows[index][leadColumn - 1]) === String(leadId)) return { sheet:sheet, rowNumber:index+2, headerMap:headers, vendorSafePackage:rowToObject_(rows[index], headers) };
    }
    return null;
  }

  function findProjectById(projectId) {
    return findProjectByColumnValue_('Project ID', projectId);
  }

  function findProjectByLeadId(leadId) {
    return findProjectByColumnValue_('Lead ID', leadId);
  }

  function findProjectByColumnValue_(columnName, value) {
    var sheet = getProjectSheet();
    var headers = getHeaderMap(sheet);
    var targetColumn = headers[columnName];
    if (!targetColumn || sheet.getLastRow() < 2) return null;
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var index = rows.length - 1; index >= 0; index -= 1) {
      if (String(rows[index][targetColumn - 1]) === String(value)) return { sheet:sheet, rowNumber:index+2, headerMap:headers, project:rowToObject_(rows[index], headers) };
    }
    return null;
  }

  /* old compatibility body removed */
  function oldFindProjectByLeadId_(leadId) {
    var sheet = getProjectSheet();
    var headers = getHeaderMap(sheet);
    var leadColumn = headers['Lead ID'];
    if (!leadColumn || sheet.getLastRow() < 2) return null;
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var index = rows.length - 1; index >= 0; index -= 1) {
      if (String(rows[index][leadColumn - 1]) === String(leadId)) return { sheet:sheet, rowNumber:index+2, headerMap:headers, project:rowToObject_(rows[index], headers) };
    }
    return null;
  }

  function findLatestDeliveryRecordByProjectId(projectId) {
    var sheet = getDeliveryRecordSheet();
    var headers = getHeaderMap(sheet);
    var projectColumn = headers['Project ID'];
    if (!projectColumn || sheet.getLastRow() < 2) return null;
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var index = rows.length - 1; index >= 0; index -= 1) {
      if (String(rows[index][projectColumn - 1]) === String(projectId)) return { sheet:sheet, rowNumber:index+2, headerMap:headers, deliveryRecord:rowToObject_(rows[index], headers) };
    }
    return null;
  }

  function findLatestVendorPricingByLeadId(leadId) {
    var rows = findVendorPricingRowsByColumnValue_('Lead ID', leadId);
    if (!rows.length) return null;

    var latest = rows.filter(function (row) {
      return String(row.pricing['Latest Revision'] || '').trim().toLowerCase() === 'yes';
    })[0];
    if (latest) return latest;

    return rows.sort(function (a, b) {
      return Number(b.pricing['Quote Revision'] || 0) - Number(a.pricing['Quote Revision'] || 0);
    })[0];
  }

  function findVendorPricingByPricingId(pricingId) {
    return findVendorPricingByColumnValue_('Pricing ID', pricingId);
  }

  function findVendorPricingByColumnValue_(columnName, value) {
    var rows = findVendorPricingRowsByColumnValue_(columnName, value);
    return rows.length ? rows[0] : null;
  }

  function findVendorPricingRowsByColumnValue_(columnName, value) {
    var sheet = getVendorPricingSheet();
    var headerMap = getHeaderMap(sheet);
    var targetColumn = headerMap[columnName];
    if (!targetColumn) throw new Error(columnName + ' column missing.');

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var matches = [];
    var values = sheet.getRange(2, targetColumn, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i += 1) {
      if (String(values[i][0]) === String(value)) {
        var rowNumber = i + 2;
        var rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
        matches.push({
          sheet: sheet,
          rowNumber: rowNumber,
          headerMap: headerMap,
          rowValues: rowValues,
          pricing: rowToObject_(rowValues, headerMap)
        });
      }
    }

    return matches;
  }

  function updateLeadById(leadId, updates) {
    var result = findLeadById(leadId);
    if (!result) {
      throw new Error('Lead not found: ' + leadId);
    }
    updateRowByHeaders_(result.sheet, result.rowNumber, result.headerMap, updates);
    refreshPipelineSafely_();
    return findLeadById(leadId);
  }

  function updateVendorPricingByPricingId(pricingId, updates) {
    var result = findVendorPricingByPricingId(pricingId);
    if (!result) {
      throw new Error('Vendor pricing not found: ' + pricingId);
    }
    updateRowByHeaders_(result.sheet, result.rowNumber, result.headerMap, updates);
    return findVendorPricingByPricingId(pricingId);
  }

  function updateRowByHeaders_(sheet, rowNumber, headerMap, updates) {
    Object.keys(updates).forEach(function (header) {
      var column = headerMap[header];
      if (!column) {
        throw new Error('Cannot update missing column: ' + header);
      }
      sheet.getRange(rowNumber, column).setValue(updates[header]);
    });
  }

  function rowToObject_(rowValues, headerMap) {
    return Object.keys(headerMap).reduce(function (obj, header) {
      obj[header] = rowValues[headerMap[header] - 1];
      return obj;
    }, {});
  }

  function createBlankRow_(length) {
    var row = [];
    for (var i = 0; i < length; i += 1) row.push('');
    return row;
  }

  function refreshPipelineSafely_() {
    try {
      if (typeof MidtsPipelineService !== 'undefined') MidtsPipelineService.refresh();
    } catch (error) {
      console.log('Pipeline refresh skipped: ' + String(error && error.message ? error.message : error));
    }
  }

  function ensureLaunchSheets() {
    getOrCreateSheet(SHEETS.LEADS, LEAD_HEADERS);
    getOrCreateSheet(SHEETS.TECHNICAL_INTAKE, TECHNICAL_INTAKE_HEADERS);
    getOrCreateSheet(SHEETS.TECHNICAL_REVIEWS, TECHNICAL_REVIEW_HEADERS);
    getOrCreateSheet(SHEETS.VENDOR_SAFE_PACKAGES, VENDOR_SAFE_PACKAGE_HEADERS);
    getOrCreateSheet(SHEETS.PROJECTS, PROJECT_HEADERS);
    getOrCreateSheet(SHEETS.DELIVERY_RECORDS, DELIVERY_RECORD_HEADERS);
    getOrCreateSheet(SHEETS.VENDOR_PRICING, VENDOR_PRICING_HEADERS);
    getOrCreateSheet(SHEETS.WEBHOOK_LOGS, LOG_HEADERS);
    getOrCreateSheet(SHEETS.EMAIL_LOGS, EMAIL_LOG_HEADERS);
    refreshPipelineSafely_();
    return {
      leadsSheet: SHEETS.LEADS,
      technicalIntakeSheet: SHEETS.TECHNICAL_INTAKE,
      technicalReviewsSheet: SHEETS.TECHNICAL_REVIEWS,
      vendorSafePackagesSheet: SHEETS.VENDOR_SAFE_PACKAGES,
      projectsSheet: SHEETS.PROJECTS,
      deliveryRecordsSheet: SHEETS.DELIVERY_RECORDS,
      vendorPricingSheet: SHEETS.VENDOR_PRICING,
      logsSheet: SHEETS.WEBHOOK_LOGS,
      emailLogsSheet: SHEETS.EMAIL_LOGS
    };
  }

  return {
    SHEETS: SHEETS,
    LEAD_HEADERS: LEAD_HEADERS,
    TECHNICAL_INTAKE_HEADERS: TECHNICAL_INTAKE_HEADERS,
    TECHNICAL_REVIEW_HEADERS: TECHNICAL_REVIEW_HEADERS,
    VENDOR_SAFE_PACKAGE_HEADERS: VENDOR_SAFE_PACKAGE_HEADERS,
    PROJECT_HEADERS: PROJECT_HEADERS,
    DELIVERY_RECORD_HEADERS: DELIVERY_RECORD_HEADERS,
    VENDOR_PRICING_HEADERS: VENDOR_PRICING_HEADERS,
    LOG_HEADERS: LOG_HEADERS,
    EMAIL_LOG_HEADERS: EMAIL_LOG_HEADERS,
    appendLeadRow: appendLeadRow,
    appendTechnicalIntakeRow: appendTechnicalIntakeRow,
    appendTechnicalReviewRow: appendTechnicalReviewRow,
    appendVendorSafePackageRow: appendVendorSafePackageRow,
    appendProjectRow: appendProjectRow,
    appendDeliveryRecordRow: appendDeliveryRecordRow,
    appendVendorPricingRow: appendVendorPricingRow,
    appendWebhookLog: appendWebhookLog,
    appendEmailLog: appendEmailLog,
    findLeadById: findLeadById,
    findLeadBySubmissionId: findLeadBySubmissionId,
    findVendorPricingByLeadId: findVendorPricingByLeadId,
    findLatestTechnicalIntakeByLeadId: findLatestTechnicalIntakeByLeadId,
    findLatestTechnicalReviewByLeadId: findLatestTechnicalReviewByLeadId,
    findLatestVendorSafePackageByLeadId: findLatestVendorSafePackageByLeadId,
    findProjectById: findProjectById,
    findProjectByLeadId: findProjectByLeadId,
    findLatestDeliveryRecordByProjectId: findLatestDeliveryRecordByProjectId,
    findLatestVendorPricingByLeadId: findLatestVendorPricingByLeadId,
    findVendorPricingByPricingId: findVendorPricingByPricingId,
    updateLeadById: updateLeadById,
    updateVendorPricingByPricingId: updateVendorPricingByPricingId,
    ensureLaunchSheets: ensureLaunchSheets
  };
})();
