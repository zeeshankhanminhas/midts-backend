var MidtsTechnicalReviewService = (function () {
  var FEASIBILITY_VALUES = [
    'Feasible',
    'Feasible with Assumptions',
    'Clarification Required',
    'Outside Available Capability',
    'Not Feasible'
  ];

  var BUSINESS_RECOMMENDATION_VALUES = [
    'Qualified',
    'Needs More Info',
    'Nurture',
    'Not Suitable'
  ];

  var TECHNICAL_REVIEW_HEADERS = [
    'Technical Review ID',
    'Lead ID',
    'Technical Intake ID',
    'Created At',
    'Reviewer Type',
    'Reviewer',
    'Reviewer Organisation',
    'Reviewer Email',
    'Review Request ID',
    'Source Package ID',
    'Assessment Scope',
    'Files Reviewed',
    'File Review',
    'Files And Revisions Reviewed',
    'Drawing Revision Reviewed',
    'Partner Review Package Link',
    'Partner Assessment Document Link',
    'Feasibility Status',
    'Technical Outcome',
    'Proposed Process',
    'Machine/Axis Requirement',
    'Critical Features',
    'Manufacturing Risks',
    'Inspection Requirements',
    'Assumptions',
    'Clarifications Required',
    'Estimated Engineering Hours',
    'Estimated Lead Time',
    'Deliverables',
    'Partner Declaration',
    'Partner Submitted At',
    'Review Valid Until',
    'Review Status',
    'Review Summary',
    'Risks',
    'Clarifications',
    'MIDTS Qualification Recommendation',
    'Recommendation',
    'Internal Notes',
    'Approved At',
    'Last Updated At'
  ];

  function recordReview(input) {
    input = input || {};
    var leadId = clean_(input.leadId || input.lead_id);
    if (!leadId) return fieldError_('leadId', 'Lead ID is required.', 'MISSING_LEAD_ID');

    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    if (String(leadResult.lead['Lifecycle Status'] || '') !== 'Pending Review') {
      return { ok: false, code: 'LEAD_NOT_READY_FOR_TECHNICAL_REVIEW', message: 'Lead must be Pending Review before a partner technical assessment can be recorded.' };
    }

    var intakeResult = MidtsSheetService.findLatestTechnicalIntakeByLeadId(leadId);
    if (!intakeResult) return { ok: false, code: 'TECHNICAL_INTAKE_NOT_FOUND', message: 'Technical Intake is required before partner technical assessment.' };

    var reviewerType = clean_(input.reviewerType || input.reviewer_type || 'Approved Outsourced Partner');
    var reviewer = clean_(input.reviewer || input.partnerReviewer || input.partner_reviewer);
    var reviewerOrganisation = clean_(input.reviewerOrganisation || input.reviewer_organisation || input.partnerOrganisation || input.partner_organisation);
    var reviewerEmail = clean_(input.reviewerEmail || input.reviewer_email || input.partnerReviewerEmail || input.partner_reviewer_email);
    var reviewRequestId = clean_(input.reviewRequestId || input.review_request_id);
    var sourcePackageId = clean_(input.sourcePackageId || input.source_package_id || input.vendorSafePackageId || input.vendor_safe_package_id);
    var assessmentScope = clean_(input.assessmentScope || input.assessment_scope || input.reviewScope || input.review_scope);
    var filesAndRevisionsReviewed = clean_(input.filesAndRevisionsReviewed || input.files_and_revisions_reviewed || input.fileReview || input.file_review);
    var filesReviewed = normalizeList_(input.filesReviewed || input.files_reviewed || filesAndRevisionsReviewed);
    var drawingRevisionReviewed = clean_(input.drawingRevisionReviewed || input.drawing_revision_reviewed);
    var partnerReviewPackageLink = clean_(input.partnerReviewPackageLink || input.partner_review_package_link || input.reviewPackageLink || input.review_package_link);
    var partnerAssessmentDocumentLink = clean_(input.partnerAssessmentDocumentLink || input.partner_assessment_document_link || input.assessmentDocumentLink || input.assessment_document_link);
    var feasibilityStatus = normalizeFeasibility_(input.feasibilityStatus || input.feasibility_status || input.technicalOutcome || input.technical_outcome);
    var proposedProcess = clean_(input.proposedProcess || input.proposed_process);
    var machineAxisRequirement = clean_(input.machineAxisRequirement || input.machine_axis_requirement);
    var criticalFeatures = normalizeList_(input.criticalFeatures || input.critical_features);
    var manufacturingRisks = normalizeList_(input.manufacturingRisks || input.manufacturing_risks || input.risks);
    var inspectionRequirements = normalizeList_(input.inspectionRequirements || input.inspection_requirements);
    var assumptions = normalizeList_(input.assumptions);
    var clarificationsRequired = normalizeList_(input.clarificationsRequired || input.clarifications_required || input.clarifications);
    var estimatedEngineeringHours = clean_(input.estimatedEngineeringHours || input.estimated_engineering_hours);
    var estimatedLeadTime = clean_(input.estimatedLeadTime || input.estimated_lead_time);
    var deliverables = normalizeList_(input.deliverables);
    var partnerDeclaration = clean_(input.partnerDeclaration || input.partner_declaration);
    var reviewValidUntil = parseOptionalDate_(input.reviewValidUntil || input.review_valid_until);
    var partnerSubmittedAt = parseSubmittedAt_(input.partnerSubmittedAt || input.partner_submitted_at || input.assessmentSubmittedAt || input.assessment_submitted_at);
    var summary = clean_(input.reviewSummary || input.review_summary || input.technicalAssessmentSummary || input.technical_assessment_summary);
    var internalNotes = clean_(input.internalNotes || input.internal_notes);
    var businessRecommendation = normalizeRecommendation_(input.recommendation || input.businessRecommendation || input.business_recommendation);
    var risks = normalizeList_(input.risks || manufacturingRisks);
    var clarifications = normalizeList_(input.clarifications || clarificationsRequired);
    var fileReview = normalizeList_(input.fileReview || input.file_review || filesAndRevisionsReviewed);

    var validation = validateAssessment_({
      reviewerType: reviewerType,
      reviewer: reviewer,
      reviewerOrganisation: reviewerOrganisation,
      reviewerEmail: reviewerEmail,
      assessmentScope: assessmentScope,
      filesAndRevisionsReviewed: filesAndRevisionsReviewed,
      partnerReviewPackageLink: partnerReviewPackageLink,
      partnerAssessmentDocumentLink: partnerAssessmentDocumentLink,
      feasibilityStatus: feasibilityStatus,
      partnerSubmittedAt: partnerSubmittedAt,
      summary: summary,
      businessRecommendation: businessRecommendation,
      risks: risks,
      assumptions: assumptions,
      internalNotes: internalNotes,
      partnerDeclaration: partnerDeclaration
    });
    if (!validation.ok) return validation;

    var now = new Date();
    var reviewId = 'PTA-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);

    appendTechnicalReviewRow_([
      reviewId,
      leadId,
      intakeResult.intake['Technical Intake ID'] || '',
      now,
      reviewerType,
      reviewer,
      reviewerOrganisation,
      reviewerEmail,
      reviewRequestId,
      sourcePackageId,
      assessmentScope,
      JSON.stringify(filesReviewed),
      JSON.stringify(fileReview),
      filesAndRevisionsReviewed,
      drawingRevisionReviewed,
      partnerReviewPackageLink,
      partnerAssessmentDocumentLink,
      feasibilityStatus,
      feasibilityStatus,
      proposedProcess,
      machineAxisRequirement,
      JSON.stringify(criticalFeatures),
      JSON.stringify(manufacturingRisks),
      JSON.stringify(inspectionRequirements),
      JSON.stringify(assumptions),
      JSON.stringify(clarificationsRequired),
      estimatedEngineeringHours,
      estimatedLeadTime,
      JSON.stringify(deliverables),
      partnerDeclaration,
      partnerSubmittedAt,
      reviewValidUntil,
      'Completed',
      summary,
      JSON.stringify(risks),
      JSON.stringify(clarifications),
      businessRecommendation,
      businessRecommendation,
      internalNotes,
      now,
      now
    ]);

    var leadUpdate = MidtsSheetService.updateLeadById(leadId, {
      'Status': 'Partner Technical Assessment Complete',
      'Lifecycle Status': 'Qualification Decision',
      'Review Status': 'Partner Technical Assessment Complete',
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
      reviewerType: reviewerType,
      reviewer: reviewer,
      reviewerOrganisation: reviewerOrganisation,
      reviewerEmail: reviewerEmail,
      filesAndRevisionsReviewed: filesAndRevisionsReviewed,
      partnerReviewPackageLink: partnerReviewPackageLink,
      partnerAssessmentDocumentLink: partnerAssessmentDocumentLink,
      feasibilityStatus: feasibilityStatus,
      technicalOutcome: feasibilityStatus,
      partnerSubmittedAt: formatDateValue_(partnerSubmittedAt),
      recommendation: businessRecommendation,
      nextAction: leadUpdate.lead['Next Action']
    };
  }

  function validateAssessment_(assessment) {
    var fieldErrors = {};
    if (!assessment.reviewerType) fieldErrors.reviewerType = 'Reviewer type is required.';
    if (!assessment.reviewer) fieldErrors.reviewer = 'Partner reviewer name is required.';
    if (!assessment.reviewerOrganisation) fieldErrors.reviewerOrganisation = 'Reviewer organisation is required.';
    if (!assessment.reviewerEmail) fieldErrors.reviewerEmail = 'Reviewer email is required.';
    else if (!isEmail_(assessment.reviewerEmail)) fieldErrors.reviewerEmail = 'Reviewer email must be a valid email address.';
    if (!assessment.assessmentScope) fieldErrors.assessmentScope = 'Assessment scope is required.';
    if (!assessment.filesAndRevisionsReviewed) fieldErrors.filesAndRevisionsReviewed = 'Files and revisions reviewed are required.';
    if (!assessment.partnerReviewPackageLink) fieldErrors.partnerReviewPackageLink = 'Partner review package link is required.';
    else if (!isHttpsUrl_(assessment.partnerReviewPackageLink)) fieldErrors.partnerReviewPackageLink = 'Partner review package link must be an https URL.';
    if (!assessment.partnerAssessmentDocumentLink) fieldErrors.partnerAssessmentDocumentLink = 'Partner assessment document link is required.';
    else if (!isHttpsUrl_(assessment.partnerAssessmentDocumentLink)) fieldErrors.partnerAssessmentDocumentLink = 'Partner assessment document link must be an https URL.';
    if (!assessment.feasibilityStatus) fieldErrors.feasibilityStatus = 'Feasibility status is required.';
    if (!assessment.partnerSubmittedAt) fieldErrors.partnerSubmittedAt = 'Partner submitted timestamp is required.';
    if (!assessment.summary) fieldErrors.reviewSummary = 'Technical assessment summary is required.';
    if (!assessment.partnerDeclaration) fieldErrors.partnerDeclaration = 'Partner declaration is required.';
    if (!assessment.businessRecommendation) fieldErrors.recommendation = 'MIDTS business recommendation must be Qualified, Needs More Info, Nurture, or Not Suitable.';

    if (assessment.businessRecommendation === 'Qualified' && ['Feasible', 'Feasible with Assumptions'].indexOf(assessment.feasibilityStatus) === -1) {
      fieldErrors.recommendation = 'MIDTS cannot qualify work where the partner technical outcome is not feasible.';
    }

    if (assessment.businessRecommendation === 'Qualified' && assessment.feasibilityStatus === 'Feasible with Assumptions') {
      var assumptionEvidence = [assessment.summary, assessment.internalNotes].concat(assessment.risks || []).concat(assessment.assumptions || []).join(' ').toLowerCase();
      if (assumptionEvidence.indexOf('assumption') === -1 && assumptionEvidence.indexOf('assume') === -1) {
        fieldErrors.reviewSummary = 'Feasible with Assumptions plus Qualified requires the assumptions to be recorded.';
      }
    }

    if (Object.keys(fieldErrors).length) {
      return {
        ok: false,
        code: 'PARTNER_ASSESSMENT_VALIDATION_FAILED',
        message: 'Partner Technical Assessment is incomplete or invalid.',
        fieldErrors: fieldErrors
      };
    }
    return { ok: true };
  }

  function appendTechnicalReviewRow_(row) {
    var spreadsheetId = MidtsConfig.getSpreadsheetId();
    var spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('No spreadsheet is available for Technical Reviews.');
    var sheet = spreadsheet.getSheetByName(MidtsSheetService.SHEETS.TECHNICAL_REVIEWS) || spreadsheet.insertSheet(MidtsSheetService.SHEETS.TECHNICAL_REVIEWS);
    ensureHeaders_(sheet, TECHNICAL_REVIEW_HEADERS);
    var headerMap = headerMap_(sheet);
    var output = [];
    for (var index = 0; index < sheet.getLastColumn(); index += 1) output.push('');
    TECHNICAL_REVIEW_HEADERS.forEach(function (header, index) {
      if (headerMap[header]) output[headerMap[header] - 1] = row[index] === undefined ? '' : row[index];
    });
    sheet.appendRow(output);
  }

  function ensureHeaders_(sheet, headers) {
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }
    var existing = headerMap_(sheet);
    var missing = headers.filter(function (header) { return !existing[header]; });
    if (missing.length) sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.setFrozenRows(1);
  }

  function headerMap_(sheet) {
    var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    return headers.reduce(function (map, header, index) {
      var normalized = clean_(header);
      if (normalized && !map[normalized]) map[normalized] = index + 1;
      return map;
    }, {});
  }

  function normalizeFeasibility_(value) {
    var normalized = clean_(value).toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ');
    if (!normalized) return '';
    if (normalized === 'feasible' || normalized === 'yes feasible') return 'Feasible';
    if (normalized === 'feasible with assumptions' || normalized === 'feasible with assumption' || normalized === 'conditional feasible' || normalized === 'feasible conditional') return 'Feasible with Assumptions';
    if (normalized === 'clarification required' || normalized === 'needs clarification' || normalized === 'clarifications required') return 'Clarification Required';
    if (normalized === 'outside available capability' || normalized === 'outside capability' || normalized === 'not in capability') return 'Outside Available Capability';
    if (normalized === 'not feasible' || normalized === 'infeasible' || normalized === 'no not feasible') return 'Not Feasible';
    return '';
  }

  function normalizeRecommendation_(value) {
    var normalized = clean_(value).toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
    if (normalized === 'qualified') return 'Qualified';
    if (normalized === 'needs more info') return 'Needs More Info';
    if (normalized === 'nurture') return 'Nurture';
    if (normalized === 'not suitable') return 'Not Suitable';
    return '';
  }

  function normalizeList_(value) {
    if (Array.isArray(value)) return value.map(clean_).filter(Boolean);
    var text = clean_(value);
    if (!text) return [];
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(clean_).filter(Boolean);
    } catch (error) {}
    return text.split(/\r?\n|;/).map(clean_).filter(Boolean);
  }

  function parseSubmittedAt_(value) {
    var text = clean_(value);
    if (!text) return null;
    var date = new Date(text);
    return String(date) === 'Invalid Date' ? null : date;
  }

  function parseOptionalDate_(value) {
    var text = clean_(value);
    if (!text) return '';
    var date = new Date(text);
    return String(date) === 'Invalid Date' ? text : date;
  }

  function fieldError_(field, message, code) {
    var errors = {};
    errors[field] = message;
    return { ok: false, code: code || 'VALIDATION_FAILED', message: message, fieldErrors: errors };
  }

  function isHttpsUrl_(value) {
    return /^https:\/\/\S+$/i.test(clean_(value));
  }

  function isEmail_(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean_(value));
  }

  function formatDateValue_(value) {
    return value instanceof Date ? Utilities.formatDate(value, 'Europe/London', "yyyy-MM-dd'T'HH:mm:ssXXX") : clean_(value);
  }

  function clean_(value) {
    return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  return {
    FEASIBILITY_VALUES: FEASIBILITY_VALUES,
    BUSINESS_RECOMMENDATION_VALUES: BUSINESS_RECOMMENDATION_VALUES,
    TECHNICAL_REVIEW_HEADERS: TECHNICAL_REVIEW_HEADERS,
    normalizeFeasibility: normalizeFeasibility_,
    recordReview: recordReview
  };
})();
