var MidtsTechnicalIntakeService = (function () {
  function completeStep2(payload) {
    var input = normalizeStep2Payload(payload || {});
    var leadRecord = findLeadForStep2_(input);
    if (!leadRecord) {
      return {
        ok: false,
        code: 'LEAD_NOT_FOUND',
        message: 'Step 2 could not be matched to an existing lead.',
        input: input
      };
    }

    var lead = leadRecord.lead;
    var leadId = lead['Lead ID'];
    var now = new Date();
    var technicalIntakeId = createTechnicalIntakeId_(now);
    var filesProvided = input.filesProvided ? 'Yes' : 'No';
    var ndaRequired = input.ndaRequired ? 'Yes' : 'No';
    var vendorSafeRequired = input.filesProvided || input.ndaRequired || input.confidentialityNotes ? 'Yes' : 'No';

    MidtsSheetService.appendTechnicalIntakeRow([
      technicalIntakeId,
      leadId,
      lead['Submission ID'] || input.submissionId,
      now,
      input.serviceType,
      input.technicalScope,
      input.materials,
      input.quantity,
      input.deadline,
      filesProvided,
      input.fileLinks,
      ndaRequired,
      input.confidentialityNotes,
      vendorSafeRequired,
      'No',
      input.budgetRange,
      input.timingNotes,
      input.technicalNotes,
      MidtsLogger.safeJson(payload || {})
    ]);

    var updatedLead = MidtsSheetService.updateLeadById(leadId, {
      'Status': 'Step 2 Completed',
      'Lifecycle Status': 'Pending Review',
      'Review Status': 'Pending Review',
      'Next Action': 'Review technical requirement',
      'Next Action Due': now,
      'Step 2 Status': 'Completed',
      'Step 2 Completed At': now,
      'Files Provided': filesProvided,
      'NDA Required': ndaRequired,
      'Vendor Safe Package Required': vendorSafeRequired,
      'Vendor Safe Package Ready': 'No',
      'Drive Folder Status': 'Not Automated',
      'Last Updated At': now
    });

    return {
      ok: true,
      technicalIntakeId: technicalIntakeId,
      leadId: leadId,
      submissionId: lead['Submission ID'] || input.submissionId,
      lead: leadObjectForEmail_(updatedLead.lead),
      lifecycleStatus: 'Pending Review',
      reviewStatus: 'Pending Review',
      nextAction: 'Review technical requirement',
      vendorSafePackageRequired: vendorSafeRequired
    };
  }

  function normalizeStep2Payload(payload) {
    return {
      leadId: firstPresent_(payload, ['leadId', 'lead_id', 'midtsLeadId']),
      submissionId: firstPresent_(payload, ['submissionId', 'submission_id', 'lead_id', 'leadId']),
      serviceType: firstPresent_(payload, ['serviceType', 'service_type', 'project_type', 'projectType']),
      technicalScope: firstPresent_(payload, ['technicalScope', 'technical_scope', 'scope', 'detailed_requirement', 'technical_requirement']),
      materials: firstPresent_(payload, ['materials', 'material', 'material_specification']),
      quantity: firstPresent_(payload, ['quantity', 'qty', 'volume']),
      deadline: firstPresent_(payload, ['deadline', 'required_by', 'timeline']),
      filesProvided: truthy_(firstPresent_(payload, ['filesProvided', 'files_provided', 'has_files', 'file_upload_complete'])),
      fileLinks: firstPresent_(payload, ['fileLinks', 'file_links', 'drive_links', 'uploaded_files']),
      ndaRequired: truthy_(firstPresent_(payload, ['ndaRequired', 'nda_required', 'confidential', 'confidentiality_required'])),
      confidentialityNotes: firstPresent_(payload, ['confidentialityNotes', 'confidentiality_notes', 'nda_notes']),
      budgetRange: firstPresent_(payload, ['budgetRange', 'budget_range', 'budget']),
      timingNotes: firstPresent_(payload, ['timingNotes', 'timing_notes']),
      technicalNotes: firstPresent_(payload, ['technicalNotes', 'technical_notes', 'notes', 'additional_notes'])
    };
  }

  function findLeadForStep2_(input) {
    if (input.leadId) {
      var byLeadId = MidtsSheetService.findLeadById(input.leadId);
      if (byLeadId) return byLeadId;
    }
    if (input.submissionId) {
      var bySubmission = MidtsSheetService.findLeadBySubmissionId(input.submissionId);
      if (bySubmission) return bySubmission;
    }
    return null;
  }

  function leadObjectForEmail_(sheetLead) {
    return {
      submissionId: sheetLead['Submission ID'] || '',
      fullName: sheetLead['Full Name'] || 'there',
      email: sheetLead['Email'] || '',
      company: sheetLead['Company'] || '',
      projectType: sheetLead['Project Type'] || '',
      briefRequirement: sheetLead['Brief Requirement'] || '',
      source: sheetLead['Source'] || ''
    };
  }

  function firstPresent_(payload, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var value = payload[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  function truthy_(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === '1' || normalized === 'y';
  }

  function createTechnicalIntakeId_(date) {
    return 'TECH-' + Utilities.formatDate(date || new Date(), 'Europe/London', 'yyyyMMdd-HHmmss');
  }

  return {
    completeStep2: completeStep2,
    normalizeStep2Payload: normalizeStep2Payload
  };
})();
