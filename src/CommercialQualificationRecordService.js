var MidtsCommercialQualificationRecordService = (function () {
  function getCommercialQualificationRecord(input) {
    input = input || {};
    var leadId = String(input.leadId || input.lead_id || '').trim();
    if (!leadId) {
      return { ok: false, code: 'MISSING_LEAD_ID', message: 'Lead ID is required to read the Commercial Qualification Record.' };
    }

    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) {
      return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found: ' + leadId };
    }

    var intakeResult = MidtsSheetService.findLatestTechnicalIntakeByLeadId(leadId);
    var reviewResult = MidtsSheetService.findLatestTechnicalReviewByLeadId(leadId);
    var document = MidtsDocumentAdapterService.toCommercialQualificationRecordData(
      leadResult.lead,
      intakeResult ? intakeResult.intake : {},
      reviewResult ? reviewResult.review : {},
      { status: input.status || 'Draft' }
    );

    return {
      ok: true,
      leadId: leadId,
      documentType: 'commercialQualificationRecord',
      liveBacked: true,
      issueBlocked: Boolean(document.issueBlocked),
      missingRequiredFields: document.missingRequiredFields || [],
      document: document
    };
  }

  return {
    getCommercialQualificationRecord: getCommercialQualificationRecord
  };
})();