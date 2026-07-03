var MidtsWorkspaceReadService = (function () {
  function listPendingTechnicalReviews() {
    var leads = readSheetObjects_(MidtsSheetService.SHEETS.LEADS, MidtsSheetService.LEAD_HEADERS);
    var intakes = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_INTAKE, MidtsSheetService.TECHNICAL_INTAKE_HEADERS);
    var reviews = readSheetObjects_(MidtsSheetService.SHEETS.TECHNICAL_REVIEWS, MidtsSheetService.TECHNICAL_REVIEW_HEADERS);
    var latestIntakesByLead = latestByLeadId_(intakes, 'Completed At');
    var latestReviewsByLead = latestByLeadId_(reviews, 'Created At');

    var pending = leads.filter(function (lead) {
      var leadId = clean_(lead['Lead ID']);
      if (!leadId) return false;
      if (!step2Complete_(lead)) return false;
      if (!pendingReview_(lead)) return false;
      if (technicalReviewComplete_(lead, latestReviewsByLead[leadId])) return false;
      return Boolean(latestIntakesByLead[leadId]);
    }).map(function (lead) {
      return toPendingReviewRecord_(lead, latestIntakesByLead[clean_(lead['Lead ID'])]);
    });

    pending.sort(function (a, b) {
      return Number(new Date(b.submittedAt || b.dateCreated || 0)) - Number(new Date(a.submittedAt || a.dateCreated || 0));
    });

    return {
      ok: true,
      count: pending.length,
      reviews: pending
    };
  }

  function readSheetObjects_(sheetName, expectedHeaders) {
    var spreadsheetId = MidtsConfig.getSpreadsheetId();
    var spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('No SPREADSHEET_ID property and no active spreadsheet available.');

    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    return rows.map(function (row) {
      var object = {};
      headers.forEach(function (header, index) {
        if (header) object[header] = normalizeCell_(row[index]);
      });
      expectedHeaders.forEach(function (header) {
        if (object[header] === undefined) object[header] = '';
      });
      return object;
    });
  }

  function latestByLeadId_(rows, dateHeader) {
    return rows.reduce(function (map, row) {
      var leadId = clean_(row['Lead ID']);
      if (!leadId) return map;
      var existing = map[leadId];
      if (!existing || Number(new Date(row[dateHeader] || 0)) >= Number(new Date(existing[dateHeader] || 0))) {
        map[leadId] = row;
      }
      return map;
    }, {});
  }

  function toPendingReviewRecord_(lead, intake) {
    var rawIntake = parseJson_(intake['Raw Payload JSON']);
    var submittedAt = intake['Completed At'] || lead['Step 2 Completed At'] || lead['Last Updated At'] || lead['Created At'];
    var filesProvided = intake['Files Provided'] || lead['Files Provided'] || '';
    var fileLinks = splitList_(intake['File Links']);

    return {
      leadId: clean_(lead['Lead ID']),
      technicalIntakeId: clean_(intake['Technical Intake ID']),
      client: clean_(lead['Full Name']),
      personName: clean_(lead['Full Name']),
      company: clean_(lead['Company']),
      email: clean_(lead['Email']),
      lead: clean_(lead['Brief Requirement']) || clean_(intake['Technical Scope']) || clean_(lead['Project Type']) || 'Technical review',
      projectType: clean_(lead['Project Type']) || clean_(intake['Service Type']),
      briefRequirement: clean_(lead['Brief Requirement']),
      technicalRequirement: clean_(intake['Technical Scope']),
      timelineUrgency: clean_(rawIntake.timelineUrgency || rawIntake.timeline_urgency || intake['Deadline'] || intake['Timing Notes']),
      filesDrawingsReady: clean_(rawIntake.filesDrawingsReady || rawIntake.files_drawings_ready || filesProvided),
      requirementComplexity: clean_(rawIntake.requirementComplexity || rawIntake.requirement_complexity || intake['Technical Notes']),
      filesProvided: filesProvided,
      fileLinks: fileLinks,
      lifecycleStatus: clean_(lead['Lifecycle Status']),
      reviewStatus: clean_(lead['Review Status']),
      status: clean_(lead['Review Status']) || clean_(lead['Lifecycle Status']),
      submittedAt: toIso_(submittedAt),
      dateCreated: toIso_(lead['Created At'])
    };
  }

  function step2Complete_(lead) {
    return equivalent_(lead['Step 2 Status'], ['completed']) || equivalent_(lead['Status'], ['step 2 completed']) || Boolean(lead['Step 2 Completed At']);
  }

  function pendingReview_(lead) {
    return equivalent_(lead['Review Status'], ['pending review', 'pending', 'awaiting review']) || equivalent_(lead['Lifecycle Status'], ['pending review']);
  }

  function technicalReviewComplete_(lead, review) {
    return equivalent_(lead['Review Status'], ['technical review complete', 'completed', 'complete']) || Boolean(review && review['Technical Review ID']);
  }

  function equivalent_(value, expected) {
    var normalized = clean_(value).toLowerCase();
    return expected.indexOf(normalized) !== -1;
  }

  function normalizeCell_(value) {
    if (value instanceof Date) return toIso_(value);
    return clean_(value);
  }

  function toIso_(value) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (String(date) === 'Invalid Date') return clean_(value);
    return date.toISOString();
  }

  function splitList_(value) {
    var text = clean_(value);
    if (!text) return [];
    return text.split(/\r?\n|,|;/).map(clean_).filter(Boolean);
  }

  function parseJson_(value) {
    try {
      return JSON.parse(clean_(value) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function clean_(value) {
    return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  return {
    listPendingTechnicalReviews: listPendingTechnicalReviews
  };
})();
