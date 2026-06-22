var MidtsDocumentService = (function () {
  var SHEET_NAME = 'Documents';
  var HEADERS = [
    'Document ID', 'Lead ID', 'Quote Reference', 'Document Type', 'Revision',
    'Source', 'Status', 'Drive File ID', 'Drive URL', 'Snapshot JSON',
    'Snapshot Hash', 'Created At', 'Approved At', 'Approved By', 'Sent At',
    'Sent To', 'Last Updated At'
  ];

  function createQuoteSnapshot(lead, pricing) {
    var now = new Date();
    var quoteReference = String(lead['Quote Reference'] || pricing['Quote Reference'] || '').trim();
    if (!quoteReference) throw new Error('Quote reference is required to create a quote snapshot.');

    var snapshot = buildQuoteSnapshot_(lead, pricing, now);
    var snapshotJson = JSON.stringify(snapshot);
    var documentId = 'DOC-QT-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    appendDocument_({
      'Document ID': documentId,
      'Lead ID': lead['Lead ID'] || '',
      'Quote Reference': quoteReference,
      'Document Type': 'Quote Snapshot',
      'Revision': snapshot.revision,
      'Source': 'MIDTS Backend',
      'Status': 'Draft Snapshot',
      'Drive File ID': '',
      'Drive URL': '',
      'Snapshot JSON': snapshotJson,
      'Snapshot Hash': hash_(snapshotJson),
      'Created At': now,
      'Approved At': '',
      'Approved By': '',
      'Sent At': '',
      'Sent To': '',
      'Last Updated At': now
    });
    return { documentId: documentId, snapshot: snapshot };
  }

  function approveQuoteSnapshot(leadId, quoteReference, approver) {
    var document = findLatestQuoteSnapshot_(leadId, quoteReference);
    if (!document) return { ok: false, message: 'No quote snapshot exists for this lead and quote reference.' };

    var status = String(document.record['Status'] || '');
    if (status === 'Approved' || status === 'PDF Generated' || status === 'Sent') {
      return { ok: true, alreadyApproved: true, documentId: document.record['Document ID'] };
    }

    var now = new Date();
    updateDocument_(document, {
      'Status': 'Approved',
      'Approved At': now,
      'Approved By': approver || 'Email Approval',
      'Last Updated At': now
    });
    return { ok: true, documentId: document.record['Document ID'] };
  }

  function getApprovedQuoteSnapshot(leadId, quoteReference) {
    var document = findLatestQuoteSnapshot_(leadId, quoteReference);
    if (!document || String(document.record['Status'] || '') !== 'Approved') return null;
    return document;
  }

  function attachQuotePdf(leadId, quoteReference, driveFileId, driveUrl) {
    var document = findLatestQuoteSnapshot_(leadId, quoteReference);
    if (!document) return { ok: false, message: 'Quote snapshot not found.' };

    var status = String(document.record['Status'] || '');
    if (status === 'PDF Generated' || status === 'Sent') {
      return {
        ok: true,
        alreadyAttached: true,
        documentId: document.record['Document ID'],
        driveFileId: document.record['Drive File ID'],
        driveUrl: document.record['Drive URL']
      };
    }
    if (status !== 'Approved') {
      return { ok: false, message: 'Quote snapshot must be approved before a PDF can be attached.' };
    }
    if (!driveFileId || !driveUrl) return { ok: false, message: 'PDF Drive file details are required.' };

    updateDocument_(document, {
      'Status': 'PDF Generated',
      'Drive File ID': driveFileId,
      'Drive URL': driveUrl,
      'Last Updated At': new Date()
    });
    return { ok: true, documentId: document.record['Document ID'], driveFileId: driveFileId, driveUrl: driveUrl };
  }

  function getClientReadyQuoteSnapshot(leadId, quoteReference) {
    var document = findLatestQuoteSnapshot_(leadId, quoteReference);
    var status = document && String(document.record['Status'] || '');
    if (!document || (status !== 'PDF Generated' && status !== 'Sent') || !String(document.record['Drive File ID'] || '').trim()) return null;
    return document;
  }

  function markQuoteSnapshotSent(leadId, quoteReference, recipient) {
    var document = getClientReadyQuoteSnapshot(leadId, quoteReference);
    if (!document) return { ok: false, message: 'Generated quote PDF not found.' };
    updateDocument_(document, {
      'Status': 'Sent',
      'Sent At': new Date(),
      'Sent To': recipient || '',
      'Last Updated At': new Date()
    });
    return { ok: true, documentId: document.record['Document ID'] };
  }

  function ensureDocumentsSheet() {
    getSheet_();
    return SHEET_NAME;
  }

  function buildQuoteSnapshot_(lead, pricing, now) {
    var currency = String(pricing['Client Quote Currency'] || MidtsConfig.getScriptProperty('CLIENT_QUOTE_CURRENCY') || 'GBP').toUpperCase();
    var total = formatMoney_(pricing['Client Quote Amount'], currency);
    if (!total) throw new Error('Client quote amount is required to create a quote snapshot.');

    var validityDays = Number(MidtsConfig.getScriptProperty('QUOTE_VALIDITY_DAYS') || 30);
    if (!isFinite(validityDays) || validityDays < 1) validityDays = 30;
    return {
      schemaVersion: '1.0',
      documentType: 'quote',
      quoteReference: String(lead['Quote Reference'] || pricing['Quote Reference'] || ''),
      revision: String(pricing['Quote Revision'] || '1'),
      issuedAt: Utilities.formatDate(now, 'Europe/London', 'yyyy-MM-dd'),
      client: {
        name: String(lead['Full Name'] || ''),
        company: String(lead['Company'] || '')
      },
      project: {
        leadId: String(lead['Lead ID'] || ''),
        type: String(lead['Project Type'] || ''),
        scope: String(lead['Brief Requirement'] || 'Engineering support in line with the agreed project scope.')
      },
      commercial: {
        currency: currency,
        lineItems: [{
          item: '01',
          description: 'Engineering support in line with the quoted project scope.',
          quantity: '1',
          rate: total,
          total: total
        }],
        subtotal: total,
        vat: MidtsConfig.getScriptProperty('QUOTE_VAT_TEXT') || 'Subject to VAT where applicable',
        total: total,
        validity: validityDays + ' Days From Issue'
      },
      terms: {
        assumptions: [
          'Source data and project inputs are supplied before work commences.',
          'Client review feedback is consolidated into a single controlled response.'
        ],
        exclusions: [
          'Additional revisions outside the agreed scope summary.',
          'Third-party costs unless separately stated in this quote.'
        ],
        paymentTerms: [
          MidtsConfig.getScriptProperty('QUOTE_PAYMENT_TERMS') || 'Payment terms are 14 days from invoice unless otherwise agreed.'
        ]
      }
    };
  }

  function findLatestQuoteSnapshot_(leadId, quoteReference) {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return null;
    var headers = headerMap_(values[0]);
    var matches = [];
    for (var i = 1; i < values.length; i += 1) {
      if (String(values[i][headers['Lead ID'] - 1]) === String(leadId) &&
          String(values[i][headers['Quote Reference'] - 1]) === String(quoteReference) &&
          String(values[i][headers['Document Type'] - 1]) === 'Quote Snapshot') {
        matches.push(rowResult_(sheet, i + 1, headers, values[i]));
      }
    }
    return matches.sort(function (left, right) {
      return new Date(right.record['Created At'] || 0).getTime() - new Date(left.record['Created At'] || 0).getTime();
    })[0] || null;
  }

  function getSheet_() {
    var id = MidtsConfig.getSpreadsheetId();
    var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('No spreadsheet is available for document records.');
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    var existing = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    else {
      var missing = HEADERS.filter(function (header) { return existing.indexOf(header) === -1; });
      if (missing.length) sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    }
    sheet.setFrozenRows(1);
    return sheet;
  }

  function appendDocument_(record) {
    getSheet_().appendRow(HEADERS.map(function (header) { return record[header] === undefined ? '' : record[header]; }));
  }

  function updateDocument_(document, updates) {
    Object.keys(updates).forEach(function (header) {
      document.sheet.getRange(document.rowNumber, document.headers[header]).setValue(updates[header]);
    });
  }

  function rowResult_(sheet, rowNumber, headers, row) {
    var record = {};
    Object.keys(headers).forEach(function (header) { record[header] = row[headers[header] - 1]; });
    return { sheet: sheet, rowNumber: rowNumber, headers: headers, record: record };
  }

  function headerMap_(headers) {
    return headers.reduce(function (map, header, index) { map[String(header || '').trim()] = index + 1; return map; }, {});
  }

  function hash_(value) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8).map(function (byte) {
      var safe = byte < 0 ? byte + 256 : byte;
      return ('0' + safe.toString(16)).slice(-2);
    }).join('');
  }

  function formatMoney_(value, currency) {
    var amount = Number(String(value || '').replace(/,/g, '').trim());
    if (!isFinite(amount)) return '';
    var code = String(currency || 'GBP').toUpperCase();
    return (code === 'GBP' ? '£' : code + ' ') + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return {
    ensureDocumentsSheet: ensureDocumentsSheet,
    createQuoteSnapshot: createQuoteSnapshot,
    approveQuoteSnapshot: approveQuoteSnapshot,
    getApprovedQuoteSnapshot: getApprovedQuoteSnapshot,
    attachQuotePdf: attachQuotePdf,
    getClientReadyQuoteSnapshot: getClientReadyQuoteSnapshot,
    markQuoteSnapshotSent: markQuoteSnapshotSent
  };
})();
