var MidtsPipelineService = (function () {
  var SHEET_NAME = 'Pipeline';
  var HEADERS = ['Lead ID', 'Created At', 'Client', 'Company', 'Project Type', 'Lifecycle Status', 'Next Action', 'Next Action Due', 'Vendor Pricing Status', 'Quote Reference', 'Quote Status', 'Reviewer', 'Last Updated At'];

  function refresh() {
    var ss = getSpreadsheet_();
    var source = ss.getSheetByName(MidtsSheetService.SHEETS.LEADS);
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    setup_(sheet);

    var rows = source && source.getLastRow() > 1 ? toRows_(source.getDataRange().getValues()) : [];
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).clearContent();
    if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    sheet.autoResizeColumns(1, HEADERS.length);
    return { ok: true, sheet: SHEET_NAME, rowCount: rows.length };
  }

  function ensurePipelineSheet() {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    setup_(sheet);
    return SHEET_NAME;
  }

  function toRows_(values) {
    var map = values[0].reduce(function (result, header, index) {
      result[String(header || '').trim()] = index;
      return result;
    }, {});
    return values.slice(1).filter(function (row) {
      return value_(row, map, 'Lead ID') !== '';
    }).map(function (row) {
      return [
        value_(row, map, 'Lead ID'), value_(row, map, 'Created At'), value_(row, map, 'Full Name'),
        value_(row, map, 'Company'), value_(row, map, 'Project Type'), value_(row, map, 'Lifecycle Status'),
        value_(row, map, 'Next Action'), value_(row, map, 'Next Action Due'), value_(row, map, 'Vendor Pricing Status'),
        value_(row, map, 'Quote Reference'), value_(row, map, 'Quote Status'), value_(row, map, 'Reviewer'),
        value_(row, map, 'Last Updated At')
      ];
    }).sort(function (left, right) {
      return new Date(right[12] || 0).getTime() - new Date(left[12] || 0).getTime();
    });
  }

  function setup_(sheet) {
    var current = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    var matches = current.length === HEADERS.length && HEADERS.every(function (header, index) { return header === current[index]; });
    if (!matches) {
      sheet.clear();
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
  }

  function getSpreadsheet_() {
    var id = MidtsConfig.getSpreadsheetId();
    var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('No spreadsheet is available for the Pipeline view.');
    return ss;
  }

  function value_(row, map, header) {
    var index = map[header];
    return index === undefined ? '' : row[index];
  }

  return { ensurePipelineSheet: ensurePipelineSheet, refresh: refresh };
})();