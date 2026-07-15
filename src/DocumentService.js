var MidtsDocumentService = (function () {
  var SHEET_NAME = 'Documents';
  var HEADERS = [
    'Document ID', 'Lead ID', 'Quote Reference', 'Document Type', 'Revision',
    'Source', 'Status', 'Purpose of Issue', 'Prepared By', 'Technically Reviewed By',
    'Approved For Issue By', 'Effective Date', 'Confidentiality Classification',
    'Drive File ID', 'Drive URL', 'Snapshot JSON', 'Snapshot Hash',
    'Revision History JSON', 'System Events JSON', 'Created At', 'Approved At',
    'Approved By', 'Issued At', 'Issued To', 'Last Updated At'
  ];

  function createQuoteSnapshot(lead, pricing) {
    var now = new Date();
    var quoteReference = String(lead['Quote Reference'] || pricing['Quote Reference'] || '').trim();
    if (!quoteReference) throw new Error('Quote reference is required to create a quote snapshot.');

    supersedeIssuedQuoteSnapshots_(lead['Lead ID'], quoteReference, now);
    var snapshot = buildQuoteSnapshot_(lead, pricing, now);
    var snapshotJson = JSON.stringify(snapshot);
    var documentId = 'DOC-QT-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    appendDocument_({
      'Document ID': documentId,
      'Lead ID': lead['Lead ID'] || '',
      'Quote Reference': quoteReference,
      'Document Type': 'Controlled Quotation',
      'Revision': snapshot.revision,
      'Source': 'MIDTS Backend',
      'Status': 'Draft',
      'Purpose of Issue': 'For Review',
      'Prepared By': snapshot.documentControl.preparedBy,
      'Technically Reviewed By': '',
      'Approved For Issue By': '',
      'Effective Date': '',
      'Confidentiality Classification': snapshot.documentControl.confidentialityClassification,
      'Drive File ID': '',
      'Drive URL': '',
      'Snapshot JSON': snapshotJson,
      'Snapshot Hash': hash_(snapshotJson),
      'Revision History JSON': JSON.stringify(snapshot.revisionHistory || []),
      'System Events JSON': JSON.stringify([{ event: 'Snapshot Created', at: now.toISOString() }]),
      'Created At': now,
      'Approved At': '',
      'Approved By': '',
      'Issued At': '',
      'Issued To': '',
      'Last Updated At': now
    });
    return { documentId: documentId, snapshot: snapshot };
  }

  function getQuoteDocument(input) {
    input = input || {};
    var leadId = String(input.leadId || input.lead_id || '').trim();
    var quoteSnapshotId = String(input.quoteSnapshotId || input.quote_snapshot_id || input.documentId || input.document_id || '').trim();
    var quoteReference = String(input.quoteReference || input.quote_reference || '').trim();
    if (!leadId && !quoteSnapshotId) return { ok: false, code: 'MISSING_QUOTE_DOCUMENT_REFERENCE', message: 'Lead ID or quote snapshot ID is required.' };

    var document = quoteSnapshotId ? findQuoteSnapshotByDocumentId_(quoteSnapshotId, leadId) : null;
    if (!document) document = findLatestQuoteSnapshot_(leadId, quoteReference);
    if (!document) return { ok: false, code: 'QUOTE_DOCUMENT_NOT_FOUND', message: 'Quote document snapshot was not found for this lead.' };

    var record = document.record;
    var snapshot = parseSnapshotJson_(record['Snapshot JSON']);
    if (!snapshot) return { ok: false, code: 'QUOTE_SNAPSHOT_INVALID', message: 'Quote snapshot data could not be read.' };

    return {
      ok: true,
      quoteDocument: {
        quoteSnapshotId: String(record['Document ID'] || ''),
        leadId: String(record['Lead ID'] || ''),
        quoteReference: String(record['Quote Reference'] || ''),
        documentType: String(record['Document Type'] || ''),
        revision: String(record['Revision'] || ''),
        status: canonicalStatus_(record['Status']),
        purposeOfIssue: String(record['Purpose of Issue'] || ''),
        preparedBy: String(record['Prepared By'] || ''),
        technicallyReviewedBy: String(record['Technically Reviewed By'] || ''),
        approvedForIssueBy: String(record['Approved For Issue By'] || ''),
        effectiveDate: formatDateValue_(record['Effective Date']),
        confidentialityClassification: String(record['Confidentiality Classification'] || ''),
        driveFileId: String(record['Drive File ID'] || ''),
        driveUrl: String(record['Drive URL'] || ''),
        createdAt: formatDateValue_(record['Created At']),
        approvedAt: formatDateValue_(record['Approved At']),
        approvedBy: String(record['Approved By'] || ''),
        issuedAt: formatDateValue_(record['Issued At'] || record['Sent At']),
        issuedTo: String(record['Issued To'] || record['Sent To'] || ''),
        sentAt: formatDateValue_(record['Issued At'] || record['Sent At']),
        sentTo: String(record['Issued To'] || record['Sent To'] || ''),
        lastUpdatedAt: formatDateValue_(record['Last Updated At']),
        revisionHistory: parseArrayJson_(record['Revision History JSON']),
        systemEvents: parseArrayJson_(record['System Events JSON']),
        snapshot: snapshot,
        renderData: snapshot.renderData || null
      }
    };
  }

  function approveQuoteSnapshot(leadId, quoteReference, approver) {
    var document = findLatestQuoteSnapshot_(leadId, quoteReference);
    if (!document) return { ok: false, message: 'No quote snapshot exists for this lead and quote reference.' };

    var status = canonicalStatus_(document.record['Status']);
    if (status === 'Approved' || status === 'Issued') {
      return { ok: true, alreadyApproved: true, documentId: document.record['Document ID'] };
    }

    var now = new Date();
    updateDocument_(document, {
      'Status': 'Approved',
      'Purpose of Issue': 'For Approval',
      'Approved At': now,
      'Approved By': approver || 'Workspace Quote Reviewer',
      'Approved For Issue By': approver || 'Workspace Quote Reviewer',
      'Last Updated At': now
    });
    appendSystemEvent_(document, 'Approved', now);
    return { ok: true, documentId: document.record['Document ID'] };
  }

  function getApprovedQuoteSnapshot(leadId, quoteReference) {
    var document = findLatestQuoteSnapshot_(leadId, quoteReference);
    if (!document || canonicalStatus_(document.record['Status']) !== 'Approved') return null;
    return document;
  }

  function attachQuotePdf(leadId, quoteReference, driveFileId, driveUrl) {
    var document = findLatestQuoteSnapshot_(leadId, quoteReference);
    if (!document) return { ok: false, message: 'Quote snapshot not found.' };

    var status = canonicalStatus_(document.record['Status']);
    if ((status === 'Approved' || status === 'Issued') && String(document.record['Drive File ID'] || '').trim()) {
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

    var now = new Date();
    updateDocument_(document, {
      'Drive File ID': driveFileId,
      'Drive URL': driveUrl,
      'Last Updated At': now
    });
    appendSystemEvent_(document, 'PDF Generated', now);
    return { ok: true, documentId: document.record['Document ID'], driveFileId: driveFileId, driveUrl: driveUrl };
  }

  function getClientReadyQuoteSnapshot(leadId, quoteReference) {
    var document = findLatestQuoteSnapshot_(leadId, quoteReference);
    var status = document && canonicalStatus_(document.record['Status']);
    if (!document || (status !== 'Approved' && status !== 'Issued') || !String(document.record['Drive File ID'] || '').trim()) return null;
    return document;
  }

  function markQuoteSnapshotSent(leadId, quoteReference, recipient) {
    var document = getClientReadyQuoteSnapshot(leadId, quoteReference);
    if (!document) return { ok: false, message: 'Generated quote PDF not found.' };
    var now = new Date();
    updateDocument_(document, {
      'Status': 'Issued',
      'Purpose of Issue': 'For Quotation',
      'Issued At': now,
      'Issued To': recipient || '',
      'Last Updated At': now
    });
    appendSystemEvent_(document, 'Issued', now);
    return { ok: true, documentId: document.record['Document ID'] };
  }

  function ensureDocumentsSheet() {
    getSheet_();
    return SHEET_NAME;
  }

  function buildQuoteSnapshot_(lead, pricing, now) {
    var renderData = MidtsDocumentAdapterService.toQuoteData(lead, {}, pricing, {
      status: 'Draft',
      issuedAt: now,
      revision: String(pricing['Quote Revision'] || '1'),
      purposeOfIssue: 'For Review'
    });

    return {
      schemaVersion: '2.0',
      documentType: 'controlledQuotation',
      quoteReference: renderData.reference,
      revision: renderData.revision,
      issuedAt: Utilities.formatDate(now, 'Europe/London', 'yyyy-MM-dd'),
      validUntil: renderData.validUntil,
      documentStatus: renderData.status,
      purposeOfIssue: renderData.purposeOfIssue,
      documentControl: renderData.documentControl,
      revisionHistory: [{ revision: renderData.revision, date: Utilities.formatDate(now, 'Europe/London', 'yyyy-MM-dd'), description: 'Initial controlled quotation snapshot', preparedBy: renderData.preparedBy, approvedBy: '' }],
      client: {
        name: String(lead['Full Name'] || ''),
        company: String(lead['Company'] || '')
      },
      project: {
        leadId: String(lead['Lead ID'] || ''),
        type: String(lead['Project Type'] || ''),
        scope: renderData.scopeSummary
      },
      commercial: {
        currency: renderData.currency,
        lineItems: renderData.lineItems,
        subtotal: renderData.totals.subtotal,
        vat: renderData.totals.vat,
        total: renderData.totals.total,
        validity: renderData.validity
      },
      terms: {
        assumptions: renderData.assumptions,
        exclusions: renderData.exclusions,
        paymentTerms: renderData.paymentTerms
      },
      renderData: renderData
    };
  }

  function supersedeIssuedQuoteSnapshots_(leadId, quoteReference, now) {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    var headers = headerMap_(values[0]);
    for (var i = 1; i < values.length; i += 1) {
      var matchesLead = String(values[i][headers['Lead ID'] - 1]) === String(leadId || '');
      var matchesReference = String(values[i][headers['Quote Reference'] - 1]) === String(quoteReference || '');
      var matchesType = String(values[i][headers['Document Type'] - 1]).indexOf('Quote') !== -1;
      var status = canonicalStatus_(values[i][headers['Status'] - 1]);
      if (matchesLead && matchesReference && matchesType && status === 'Issued') {
        sheet.getRange(i + 1, headers['Status']).setValue('Superseded');
        if (headers['Last Updated At']) sheet.getRange(i + 1, headers['Last Updated At']).setValue(now);
      }
    }
  }

  function findQuoteSnapshotByDocumentId_(documentId, leadId) {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return null;
    var headers = headerMap_(values[0]);
    for (var i = values.length - 1; i >= 1; i -= 1) {
      var matchesDocument = String(values[i][headers['Document ID'] - 1]) === String(documentId);
      var matchesLead = !leadId || String(values[i][headers['Lead ID'] - 1]) === String(leadId);
      var matchesType = String(values[i][headers['Document Type'] - 1]).indexOf('Quote') !== -1;
      if (matchesDocument && matchesLead && matchesType) return rowResult_(sheet, i + 1, headers, values[i]);
    }
    return null;
  }

  function findLatestQuoteSnapshot_(leadId, quoteReference) {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return null;
    var headers = headerMap_(values[0]);
    var matches = [];
    for (var i = 1; i < values.length; i += 1) {
      var matchesLead = String(values[i][headers['Lead ID'] - 1]) === String(leadId);
      var matchesReference = !quoteReference || String(values[i][headers['Quote Reference'] - 1]) === String(quoteReference);
      var matchesType = String(values[i][headers['Document Type'] - 1]).indexOf('Quote') !== -1;
      if (matchesLead && matchesReference && matchesType) matches.push(rowResult_(sheet, i + 1, headers, values[i]));
    }
    return matches.sort(function (left, right) {
      return new Date(right.record['Created At'] || 0).getTime() - new Date(left.record['Created At'] || 0).getTime();
    })[0] || null;
  }

  function parseSnapshotJson_(value) {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(String(value || '{}')); } catch (error) { return null; }
  }

  function parseArrayJson_(value) {
    if (Array.isArray(value)) return value;
    try { var parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed : []; } catch (error) { return []; }
  }

  function appendSystemEvent_(document, eventName, at) {
    var headers = document.headers || {};
    if (!headers['System Events JSON']) return;
    var events = parseArrayJson_(document.record['System Events JSON']);
    events.push({ event: eventName, at: (at || new Date()).toISOString() });
    document.sheet.getRange(document.rowNumber, headers['System Events JSON']).setValue(JSON.stringify(events));
  }

  function canonicalStatus_(value) {
    var normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'draft' || normalized === 'draft snapshot') return 'Draft';
    if (normalized === 'under review') return 'Under Review';
    if (normalized === 'approved' || normalized === 'pdf generated') return 'Approved';
    if (normalized === 'issued' || normalized === 'sent') return 'Issued';
    if (normalized === 'superseded') return 'Superseded';
    if (normalized === 'withdrawn') return 'Withdrawn';
    return normalized ? String(value || '').trim() : 'Draft';
  }

  function formatDateValue_(value) {
    if (!value) return '';
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, 'Europe/London', "yyyy-MM-dd'T'HH:mm:ssXXX");
    }
    return String(value || '');
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
      if (document.headers[header]) document.sheet.getRange(document.rowNumber, document.headers[header]).setValue(updates[header]);
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

  return {
    ensureDocumentsSheet: ensureDocumentsSheet,
    createQuoteSnapshot: createQuoteSnapshot,
    getQuoteDocument: getQuoteDocument,
    approveQuoteSnapshot: approveQuoteSnapshot,
    getApprovedQuoteSnapshot: getApprovedQuoteSnapshot,
    attachQuotePdf: attachQuotePdf,
    getClientReadyQuoteSnapshot: getClientReadyQuoteSnapshot,
    markQuoteSnapshotSent: markQuoteSnapshotSent
  };
})();