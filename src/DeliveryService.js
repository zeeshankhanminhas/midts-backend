var MidtsDeliveryService = (function () {
  function recordDelivery(projectId, details, actor) {
    if (!projectId) return { ok:false, code:'MISSING_PROJECT_ID', message:'Project ID is required.' };
    details = details || {};
    var projectResult = MidtsSheetService.findProjectById(projectId);
    if (!projectResult) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Project not found: ' + projectId };
    var project = projectResult.project;
    if (String(project['Project Status'] || '') !== 'Open') {
      return { ok:false, code:'PROJECT_NOT_OPEN', message:'Only an open project can receive a delivery record.' };
    }
    var summary = String(details.summary || '').trim();
    var deliveredFiles = String(details.deliveredFiles || '').trim();
    if (!summary || !deliveredFiles) {
      return { ok:false, code:'INCOMPLETE_DELIVERY', message:'Delivery summary and delivered file reference are required.' };
    }
    var existing = MidtsSheetService.findLatestDeliveryRecordByProjectId(projectId);
    if (existing && String(existing.deliveryRecord['Delivery Status'] || '') === 'Completed') {
      return { ok:false, code:'DELIVERY_ALREADY_COMPLETED', message:'A completed delivery record already exists for this project.' };
    }
    var now = new Date();
    var deliveryId = 'DLV-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    MidtsSheetService.appendDeliveryRecordRow([
      deliveryId, projectId, project['Lead ID'] || '', project['Quote Reference'] || '', now,
      actor || 'MIDTS Delivery Control', 'Completed', summary, deliveredFiles,
      String(details.clientReviewStatus || 'Pending client review'), now, now
    ]);
    MidtsSheetService.updateLeadById(project['Lead ID'], {
      'Lifecycle Status':'Delivery Complete',
      'Next Action':'Prepare client handover',
      'Next Action Due':now,
      'Last Updated At':now
    });
    return { ok:true, deliveryId:deliveryId, projectId:projectId, nextAction:'Prepare client handover' };
  }

  return { recordDelivery:recordDelivery };
})();