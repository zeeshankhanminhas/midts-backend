function testWorkspaceMarginRead() {
  return postSampleWorkspaceRead_('listPendingMarginReviews', 'Apps Script Margin Review Read Test').getContent();
}

function testMarginApprovalGateway() {
  var leadId = MidtsConfig.getRequiredScriptProperty('TEST_LEAD_ID');
  var sample = {
    webhookToken: MidtsConfig.getWebhookToken(),
    formStage: 'marginReview',
    action: 'approveMargin',
    leadId: leadId,
    reviewer: 'Apps Script Margin Gateway Test',
    source: 'Apps Script Margin Review Test',
    pageUrl: 'manual-margin-review-test'
  };

  return MidtsWebhookRouter.handlePost({
    postData: {
      type: 'application/json',
      contents: JSON.stringify(sample)
    }
  }).getContent();
}

function testWorkspaceQuoteBuilderRead() {
  return postSampleWorkspaceRead_('listPendingQuoteBuilders', 'Apps Script Quote Builder Read Test').getContent();
}
