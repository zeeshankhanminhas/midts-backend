var MidtsTechnicalReviewService = (function () {
  function recordReview(input) {
    input = input || {};
    var leadId = String(input.leadId || input.lead_id || '').trim();
    if (!leadId) return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required.' };

    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    if (String(leadResult.lead['Lifecycle Status'] || '') !== 'Pending Review') {
      return { ok: false, code: 'LEAD_NOT_READY_FOR_TECHNICAL_REVIEW', message: 'Lead must be Pending Review before a technical review can be recorded.' };
    }

    var intakeResult = MidtsSheetService.findLatestTechnicalIntakeByLeadId(leadId);
    if (!intakeResult) return { ok: false, code: 'TECHNICAL_INTAKE_NOT_FOUND', message: 'Technical Intake is required before technical review.' };

    var reviewer = String(input.reviewer || 'MIDTS Reviewer').trim();
    var summary = String(input.reviewSummary || input.review_summary || '').trim();
    var internalNotes = String(input.internalNotes || input.internal_notes || '').trim();
    var recommendation = normalizeRecommendation_(input.recommendation);
    if (!summary) return { ok: false, code: 'REVIEW_SUMMARY_REQUIRED', message: 'Review summary is required.' };
    if (!recommendation) return { ok: false, code: 'RECOMMENDATION_REQUIRED', message: 'Recommendation must be Qualified, Needs More Info, Nurture, or Not Suitable.' };

    var now = new Date();
    var reviewId = 'TR-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    var fileReview = normalizeList_(input.fileReview || input.file_review);
    var risks = normalizeList_(input.risks);
    var clarifications = normalizeList_(input.clarifications);

    MidtsSheetService.appendTechnicalReviewRow([
      reviewId,
      leadId,
      intakeResult.intake['Technical Intake ID'] || '',
      now,
      reviewer,
      'Completed',
      summary,
      JSON.stringify(fileReview),
      JSON.stringify(risks),
      JSON.stringify(clarifications),
      recommendation,
      now,
      now,
      internalNotes
    ]);
    writeInternalNotes_(internalNotes);

    var leadUpdate = MidtsSheetService.updateLeadById(leadId, {
      'Status': 'Technical Review Complete',
      'Lifecycle Status': 'Qualification Decision',
      'Review Status': 'Technical Review Complete',
      'Reviewer': reviewer,
      'Review Notes': summary,
      'Next Action': 'Record qualification decision',
      'Next Action Due': now,
      'Last Updated At': now
    });

    return {
      ok: true,
      reviewId: reviewId,
      leadId: leadId,
      technicalIntakeId: intakeResult.intake['Technical Intake ID'] || '',
      recommendation: recommendation,
      nextAction: leadUpdate.lead['Next Action']
    };
  }

  function writeInternalNotes_(internalNotes) {
    var spreadsheetId = MidtsConfig.getSpreadsheetId();
    var spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) return;

    var sheet = spreadsheet.getSheetByName(MidtsSheetService.SHEETS.TECHNICAL_REVIEWS);
    if (!sheet || sheet.getLastRow() < 2) return;

    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    var internalNotesColumn = 0;

    for (var index = 0; index < headers.length; index += 1) {
      if (String(headers[index] || '').trim() === 'Internal Notes') {
        internalNotesColumn = index + 1;
        break;
      }
    }

    if (!internalNotesColumn) {
      internalNotesColumn = lastColumn + 1;
      sheet.getRange(1, internalNotesColumn).setValue('Internal Notes');
    }

    sheet.getRange(sheet.getLastRow(), internalNotesColumn).setValue(internalNotes || '');
  }

  function normalizeRecommendation_(value) {
    var normalized = String(value || '').trim().toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
    if (normalized === 'qualified') return 'Qualified';
    if (normalized === 'needs more info') return 'Needs More Info';
    if (normalized === 'nurture') return 'Nurture';
    if (normalized === 'not suitable') return 'Not Suitable';
    return '';
  }

  function normalizeList_(value) {
    if (Array.isArray(value)) return value.map(clean_).filter(Boolean);
    var text = String(value || '').trim();
    if (!text) return [];
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(clean_).filter(Boolean);
    } catch (error) {}
    return text.split(/\r?\n|;/).map(clean_).filter(Boolean);
  }

  function clean_(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  return {
    recordReview: recordReview
  };
})();
