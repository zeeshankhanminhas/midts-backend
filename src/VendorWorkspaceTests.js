function testWorkspaceVendorSafePackageRead() {
  return postSampleWorkspaceRead_('listPendingVendorSafePackages', 'Apps Script Vendor Safe Read Test').getContent();
}

function testWorkspaceVendorRequestSetupRead() {
  return postSampleWorkspaceRead_('listPendingVendorRequestSetups', 'Apps Script Vendor Request Setup Read Test').getContent();
}

function testVendorSafePackageGatewayAction() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    formStage: 'vendorSafePackage',
    action: 'recordVendorSafePackage',
    leadId: leadId,
    reviewer: 'Apps Script Vendor Safe Gateway Test',
    source: 'Apps Script Vendor Safe Package Test',
    pageUrl: 'manual-vendor-safe-package-test'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  }).getContent();
}

function testVendorRequestSetupGatewayAction() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    formStage: 'vendorRequestSetup',
    action: 'setupVendorRequest',
    leadId: leadId,
    vendorName: 'Sample Vendor',
    vendorEmail: getTestEmail_(),
    packageLink: 'https://drive.google.com/sample-vendor-safe-package',
    vendorSafeFilesConfirmed: 'yes',
    source: 'Apps Script Vendor Request Setup Test',
    pageUrl: 'manual-vendor-request-setup-test'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  }).getContent();
}
