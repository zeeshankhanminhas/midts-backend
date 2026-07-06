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
    var uploadResult = input.uploadedFiles.length ? MidtsDriveService.saveClientIntakeFiles(leadId, input.uploadedFiles) : { fileLinks: [], files: [], folderUrl: '' };
    var fileLinks = mergeFileLinks_(input.fileLinks, uploadResult.fileLinks);
    var filesProvided = input.filesProvided || uploadResult.fileLinks.length ? 'Yes' : 'No';
    var ndaRequired = input.ndaRequired ? 'Yes' : 'No';
    var vendorSafeRequired = filesProvided === 'Yes' || input.ndaRequired || input.confidentialityNotes ? 'Yes' : 'No';

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
      fileLinks,
      ndaRequired,
      input.confidentialityNotes,
      vendorSafeRequired,
      'No',
      input.budgetRange,
      input.timingNotes,
      input.technicalNotes,
      MidtsLogger.safeJson(rawPayloadForSheet_(payload || {}, uploadResult))
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
      'Drive Folder Status': uploadResult.fileLinks.length ? 'Client Intake Files Uploaded' : 'Not Automated',
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
      vendorSafePackageRequired: vendorSafeRequired,
      uploadedFileLinks: uploadResult.fileLinks,
      uploadFolderUrl: uploadResult.folderUrl
    };
  }

  function normalizeStep2Payload(payload) {
    var timelineUrgency = firstPresent_(payload, ['timelineUrgency', 'timeline_urgency']);
    var requirementComplexity = firstPresent_(payload, ['requirementComplexity', 'requirement_complexity']);
    var technicalNotes = firstPresent_(payload, ['technicalNotes', 'technical_notes', 'notes', 'additional_notes']);

    return {
      leadId: firstPresent_(payload, ['leadId', 'lead_id', 'midtsLeadId']),
      submissionId: firstPresent_(payload, ['submissionId', 'submission_id', 'lead_id', 'leadId']),
      serviceType: firstPresent_(payload, ['serviceType', 'service_type', 'project_type', 'projectType']),
      technicalScope: firstPresent_(payload, ['technicalRequirement', 'technical_requirement', 'technicalScope', 'technical_scope', 'scope', 'detailed_requirement']),
      materials: firstPresent_(payload, ['materials', 'material', 'material_specification']),
      quantity: firstPresent_(payload, ['quantity', 'qty', 'volume']),
      deadline: timelineUrgency || firstPresent_(payload, ['deadline', 'required_by', 'timeline']),
      filesProvided: truthy_(firstPresent_(payload, ['filesProvided', 'files_provided', 'has_files', 'file_upload_complete'])),
      fileLinks: firstPresent_(payload, ['fileLinks', 'file_links', 'drive_links', 'uploaded_files']),
      uploadedFiles: normalizeUploadedFiles_(payload.uploadedFiles || payload.uploaded_files),
      ndaRequired: truthy_(firstPresent_(payload, ['ndaRequired', 'nda_required', 'confidential', 'confidentiality_required'])),
      confidentialityNotes: firstPresent_(payload, ['confidentialityNotes', 'confidentiality_notes', 'nda_notes', 'filesDrawingsReady', 'files_drawings_ready']),
      budgetRange: firstPresent_(payload, ['budgetRange', 'budget_range', 'budget']),
      timingNotes: firstPresent_(payload, ['timingNotes', 'timing_notes']) || timelineUrgency,
      technicalNotes: technicalNotes || requirementComplexity
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

  function normalizeUploadedFiles_(files) {
    if (!Array.isArray(files)) return [];
    return files.map(function (file) {
      return {
        name: firstPresent_(file, ['name', 'filename']),
        type: firstPresent_(file, ['type', 'mimeType', 'mime_type']) || 'application/octet-stream',
        sizeBytes: Number(file && file.sizeBytes || file && file.size_bytes || 0),
        contentBase64: firstPresent_(file, ['contentBase64', 'content_base64', 'base64'])
      };
    }).filter(function (file) {
      return file.name && file.contentBase64;
    });
  }

  function mergeFileLinks_(existing, uploadedLinks) {
    var links = [];
    if (existing) links = links.concat(String(existing).split(/[\n,]+/).map(clean_).filter(Boolean));
    if (uploadedLinks && uploadedLinks.length) links = links.concat(uploadedLinks.map(clean_).filter(Boolean));
    return links.join('\n');
  }

  function rawPayloadForSheet_(payload, uploadResult) {
    var copy = Object.assign({}, payload);
    if (Array.isArray(copy.uploadedFiles)) {
      copy.uploadedFiles = copy.uploadedFiles.map(function (file, index) {
        var saved = uploadResult.files && uploadResult.files[index];
        return {
          name: file && file.name || '',
          type: file && file.type || '',
          sizeBytes: file && file.sizeBytes || '',
          driveFileId: saved && saved.driveFileId || '',
          driveUrl: saved && saved.driveUrl || '',
          contentBase64: '[stored in Drive]'
        };
      });
    }
    return copy;
  }

  function firstPresent_(payload, keys) {
    payload = payload || {};
    for (var i = 0; i < keys.length; i += 1) {
      var value = payload[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  function clean_(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
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