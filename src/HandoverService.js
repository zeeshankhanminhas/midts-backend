var MidtsHandoverService = (function () {
  function recordHandover(projectId, details, actor) {
    if (!projectId) return { ok:false, code:'MISSING_PROJECT_ID', message:'Project ID is required.' };
    details = details || {};
    var projectResult = MidtsSheetService.findProjectById(projectId);
    if (!projectResult) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Project not found: ' + projectId };
    var delivery = MidtsSheetService.findLatestDeliveryRecordByProjectId(projectId);
    if (!delivery || String(delivery.deliveryRecord['Delivery Status'] || '') !== 'Completed') {
      return { ok:false, code:'DELIVERY_NOT_COMPLETED', message:'A completed delivery record is required before handover.' };
    }
    if (MidtsSheetService.findLatestHandoverRecordByProjectId(projectId)) {
      return { ok:false, code:'HANDOVER_ALREADY_RECORDED', message:'A handover record already exists for this project.' };
    }
    var releaseNotes = String(details.releaseNotes || '').trim();
    var releasedFiles = String(details.releasedFiles || '').trim();
    if (!releaseNotes || !releasedFiles) {
      return { ok:false, code:'INCOMPLETE_HANDOVER', message:'Release notes and released file reference are required.' };
    }
    var now = new Date();
    var handoverId = 'HND-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    var project = projectResult.project;
    MidtsSheetService.appendHandoverRecordRow([
      handoverId, projectId, project['Lead ID'] || '', delivery.deliveryRecord['Delivery Record ID'] || '', now,
      actor || 'MIDTS Delivery Control', 'Released', releaseNotes, releasedFiles,
      String(details.clientAcceptanceStatus || 'Pending client acceptance'), '', now
    ]);
    MidtsSheetService.updateLeadById(project['Lead ID'], {
      'Lifecycle Status':'Handover Complete',
      'Next Action':'Issue invoice',
      'Next Action Due':now,
      'Last Updated At':now
    });
    return { ok:true, handoverId:handoverId, projectId:projectId, nextAction:'Issue invoice' };
  }
  return { recordHandover:recordHandover };
})();