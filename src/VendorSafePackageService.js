var MidtsVendorSafePackageService = (function () {
  function preparePackage(leadId, reviewer) {
    if (!leadId) return { ok:false, code:'MISSING_LEAD_ID', message:'Lead ID is required.' };
    var leadResult = MidtsSheetService.findLeadById(leadId);
    if (!leadResult) return { ok:false, code:'LEAD_NOT_FOUND', message:'Lead not found: ' + leadId };
    if (String(leadResult.lead['Lifecycle Status'] || '') !== 'Vendor Safe Review') {
      return { ok:false, code:'LEAD_NOT_READY', message:'Lead must be in Vendor Safe Review.' };
    }
    var review = MidtsSheetService.findLatestTechnicalReviewByLeadId(leadId);
    if (!review || String(review.review['Recommendation'] || '') !== 'Qualified') {
      return { ok:false, code:'TECHNICAL_REVIEW_REQUIRED', message:'A Qualified Technical Review is required.' };
    }
    var previous = MidtsSheetService.findLatestVendorSafePackageByLeadId(leadId);
    if (previous && String(previous.vendorSafePackage['Package Status'] || '') === 'Approved for Vendor Pricing') {
      return { ok:true, alreadyPrepared:true, packageId:previous.vendorSafePackage['Package ID'], driveFolderUrl:previous.vendorSafePackage['Drive Folder URL'] };
    }
    var intakeResult = MidtsSheetService.findLatestTechnicalIntakeByLeadId(leadId);
    var intake = intakeResult ? intakeResult.intake : {};
    var now = new Date();
    var data = {
      schemaVersion:'1.0',
      packageType:'vendor-safe',
      projectReference:String(leadResult.lead['Lead ID'] || ''),
      projectType:String(leadResult.lead['Project Type'] || ''),
      technicalScope:String(intake['Technical Scope'] || leadResult.lead['Brief Requirement'] || ''),
      materials:String(intake['Materials'] || ''),
      quantity:String(intake['Quantity'] || ''),
      deadline:String(intake['Deadline'] || ''),
      filesProvided:String(intake['Files Provided'] || ''),
      confidentialityNotes:String(intake['Confidentiality Notes'] || ''),
      reviewSummary:String(review.review['Review Summary'] || ''),
      exclusions:['Client identity and direct contact details.','Vendor cost, MIDTS margin, client price, and payment terms.']
    };
    var json = JSON.stringify(data);
    var folder = MidtsDriveService.getVendorSafeFolder(leadId);
    var packageId = 'VSP-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random()*9000+1000);
    MidtsSheetService.appendVendorSafePackageRow([packageId,leadId,review.review['Technical Review ID']||'',now,reviewer||'Vendor Safe Review','Approved for Vendor Pricing',folder.getUrl(),json,hash_(json),now,now]);
    return { ok:true, packageId:packageId, driveFolderUrl:folder.getUrl(), package:data };
  }
  function hash_(value) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8).map(function(byte) {
      var safe=byte<0?byte+256:byte;
      return ('0'+safe.toString(16)).slice(-2);
    }).join('');
  }
  return { preparePackage:preparePackage };
})();