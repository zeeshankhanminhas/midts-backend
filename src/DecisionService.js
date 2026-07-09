var MidtsDecisionService = (function () {
  var DECISIONS = {
    qualified: 'Qualified',
    'needs-more-info': 'Needs More Info',
    nurture: 'Nurture',
    'not-suitable': 'Not Suitable'
  };

  function handleDecisionRequest(e) {
    var params = e && e.parameter || {};
    return htmlResponse_(
      'Qualification Decision moved to Workspace',
      'Legacy Apps Script decision links are disabled. Open MIDTS Workspace and record the qualification decision from the Qualification Decisions queue for lead ' + String(params.leadId || '') + '.'
    );
  }

  function applyDecision(leadId, decisionKey, reviewer) {
    var normalizedDecision = normalizeDecision_(decisionKey);
    var decisionLabel = DECISIONS[normalizedDecision];
    if (!decisionLabel) {
      throw new Error('Unsupported decision: ' + decisionKey);
    }

    var existing = MidtsSheetService.findLeadById(leadId);
    if (!existing) {
      throw new Error('Lead not found: ' + leadId);
    }

    var guardResult = guardExistingDecision_(existing, normalizedDecision, decisionLabel, reviewer);
    if (guardResult) return guardResult;

    var technicalReviewGuard = guardTechnicalReview_(existing, normalizedDecision);
    if (technicalReviewGuard) return technicalReviewGuard;

    var now = new Date();
    var updates = buildDecisionUpdates_(normalizedDecision, decisionLabel, reviewer, now, existing.lead);
    var updatedLead = MidtsSheetService.updateLeadById(leadId, updates);
    var outcomeEmailResult = {
      ok: true,
      status: 'workspace_controlled_skipped',
      message: 'Legacy Apps Script outcome emails are disabled. Workspace controls follow-up actions.'
    };

    MidtsLogger.logWebhookAttempt({
      requestId: 'DECISION-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'decision',
      message: 'Decision recorded from Workspace: ' + decisionLabel + '; legacy outcome email skipped',
      payload: {
        leadId: leadId,
        decision: decisionLabel,
        reviewer: reviewer || 'Workspace Approval',
        outcomeEmailStatus: outcomeEmailResult.status
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Workspace Qualification Decision'
    });

    return {
      ok: true,
      leadId: leadId,
      decision: normalizedDecision,
      decisionLabel: decisionLabel,
      nextAction: updates['Next Action'],
      outcomeEmailStatus: outcomeEmailResult.status,
      updates: updates
    };
  }

  function guardTechnicalReview_(existing, decisionKey) {
    if (decisionKey === 'nurture') return null;

    var lead = existing.lead;
    var reviewResult = MidtsSheetService.findLatestTechnicalReviewByLeadId(lead['Lead ID']);
    if (!reviewResult) {
      return {
        ok: false,
        blocked: true,
        leadId: lead['Lead ID'],
        message: 'A completed Technical Review is required before this qualification decision.'
      };
    }

    var recommendation = String(reviewResult.review['Recommendation'] || '').trim();
    var expected = {
      qualified: 'Qualified',
      'needs-more-info': 'Needs More Info',
      'not-suitable': 'Not Suitable'
    }[decisionKey];

    if (expected && recommendation !== expected) {
      return {
        ok: false,
        blocked: true,
        leadId: lead['Lead ID'],
        message: 'Technical Review recommendation is ' + (recommendation || 'blank') + '; it must be ' + expected + ' for this decision.'
      };
    }
    return null;
  }

  function guardExistingDecision_(existing, requestedDecisionKey, requestedDecisionLabel, reviewer) {
    var lead = existing.lead;
    var leadId = lead['Lead ID'];
    var existingApproval = String(lead['Human Approval'] || '').trim();
    var existingDecisionLabel = String(lead['Qualification Decision'] || '').trim();

    if (existingApproval !== 'Approved' && !existingDecisionLabel) {
      return null;
    }

    var existingDecisionKey = normalizeDecision_(existingDecisionLabel);
    var sameDecision = existingDecisionKey === requestedDecisionKey;
    var now = new Date();
    var outcome = sameDecision ? 'decision_duplicate' : 'decision_conflict';
    var message = sameDecision
      ? 'Duplicate decision ignored: ' + existingDecisionLabel
      : 'Conflicting decision blocked. Existing: ' + existingDecisionLabel + ', requested: ' + requestedDecisionLabel;

    MidtsLogger.logWebhookAttempt({
      requestId: 'DECISION-GUARD-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: outcome,
      message: message,
      payload: {
        leadId: leadId,
        existingDecision: existingDecisionLabel,
        requestedDecision: requestedDecisionLabel,
        reviewer: reviewer || 'Workspace Approval'
      },
      submissionId: lead['Submission ID'] || '',
      email: lead['Email'] || '',
      source: 'Workspace Qualification Decision'
    });

    if (sameDecision) {
      return {
        ok: true,
        alreadyProcessed: true,
        leadId: leadId,
        decision: requestedDecisionKey,
        decisionLabel: existingDecisionLabel,
        nextAction: lead['Next Action'] || '',
        outcomeEmailStatus: 'skipped',
        message: 'Decision already recorded; no duplicate email sent.'
      };
    }

    return {
      ok: false,
      blocked: true,
      leadId: leadId,
      decision: requestedDecisionKey,
      decisionLabel: existingDecisionLabel,
      requestedDecisionLabel: requestedDecisionLabel,
      nextAction: lead['Next Action'] || '',
      outcomeEmailStatus: 'skipped',
      message: message
    };
  }

  function buildDecisionUpdates_(decisionKey, decisionLabel, reviewer, now, lead) {
    var base = {
      'Qualification Decision': decisionLabel,
      'Human Approval': 'Approved',
      'Reviewer': reviewer || 'Workspace Approval',
      'Decision Timestamp': now,
      'Review Status': 'Approved',
      'Last Updated At': now
    };

    if (decisionKey === 'qualified') {
      return Object.assign(base, buildQualifiedUpdates_(now, lead || {}));
    }

    if (decisionKey === 'needs-more-info') {
      return Object.assign(base, {
        'Status': 'Needs More Info',
        'Lifecycle Status': 'Info Required',
        'Next Action': 'Send info request',
        'Next Action Due': now,
        'Info Request Status': 'Required',
        'Quote Required': 'No',
        'Quote Status': '',
        'Vendor Pricing Required': 'No',
        'Vendor Pricing Status': '',
        'Nurture Status': '',
        'Final Outcome': ''
      });
    }

    if (decisionKey === 'nurture') {
      return Object.assign(base, {
        'Status': 'Nurture',
        'Lifecycle Status': 'Nurture',
        'Next Action': 'Nurture follow-up',
        'Next Action Due': dateDaysFrom_(7),
        'Nurture Status': 'Scheduled',
        'Next Nurture Date': dateDaysFrom_(7),
        'Nurture Attempts': 0,
        'Quote Required': 'No',
        'Quote Status': '',
        'Vendor Pricing Required': 'No',
        'Vendor Pricing Status': '',
        'Info Request Status': '',
        'Final Outcome': ''
      });
    }

    return Object.assign(base, {
      'Status': 'Closed',
      'Lifecycle Status': 'Closed',
      'Next Action': 'None',
      'Next Action Due': '',
      'Quote Required': 'No',
      'Quote Status': '',
      'Vendor Pricing Required': 'No',
      'Vendor Pricing Status': '',
      'Info Request Status': '',
      'Nurture Status': '',
      'Final Outcome': 'Not Suitable',
      'Close Reason': 'Marked not suitable from review decision',
      'Closed At': now
    });
  }

  function buildQualifiedUpdates_(now, lead) {
    var quoteReference = lead['Quote Reference'] || createQuoteReference_(now);
    var vendorSafeRequired = isYes_(lead['Vendor Safe Package Required']);
    var vendorSafeReady = isYes_(lead['Vendor Safe Package Ready']);

    if (vendorSafeRequired && !vendorSafeReady) {
      return {
        'Status': 'Qualified',
        'Lifecycle Status': 'Vendor Safe Review',
        'Next Action': 'Prepare vendor-safe package',
        'Next Action Due': now,
        'Quote Required': 'Yes',
        'Quote Reference': quoteReference,
        'Quote Status': 'Waiting Vendor Safe Package',
        'Vendor Pricing Required': 'Yes',
        'Vendor Pricing Status': 'Vendor Safe Package Required',
        'Capability Statement Required': 'No',
        'Info Request Status': '',
        'Nurture Status': '',
        'Final Outcome': ''
      };
    }

    return {
      'Status': 'Qualified',
      'Lifecycle Status': 'Vendor Pricing',
      'Next Action': 'Contact vendor',
      'Next Action Due': now,
      'Quote Required': 'Yes',
      'Quote Reference': quoteReference,
      'Quote Status': 'Waiting Vendor Price',
      'Vendor Pricing Required': 'Yes',
      'Vendor Pricing Status': 'Contact Vendor',
      'Capability Statement Required': 'No',
      'Info Request Status': '',
      'Nurture Status': '',
      'Final Outcome': ''
    };
  }

  function buildDecisionUrl(leadId, decisionKey) {
    var baseUrl = MidtsConfig.getScriptProperty('WORKSPACE_BASE_URL') || 'https://new-midts.vercel.app';
    return String(baseUrl || '').replace(/\/+$/, '') + '/workspace/qualification/review?leadId=' + encodeURIComponent(leadId || '') + '&decision=' + encodeURIComponent(decisionKey || '');
  }

  function normalizeDecision_(decision) {
    return String(decision || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  }

  function createQuoteReference_(date) {
    return 'Q-' + Utilities.formatDate(date || new Date(), 'Europe/London', 'yyyyMMdd-HHmmss');
  }

  function dateDaysFrom_(days) {
    var date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  function isYes_(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === 'required';
  }

  function htmlResponse_(title, message) {
    return HtmlService.createHtmlOutput([
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>' + escapeHtml_(title) + '</title></head>',
      '<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;padding:32px;max-width:760px;margin:0 auto">',
      '<h1 style="font-size:24px;margin:0 0 16px">' + escapeHtml_(title) + '</h1>',
      '<p style="font-size:16px;margin:0">' + escapeHtml_(message) + '</p>',
      '</body></html>'
    ].join(''));
  }

  function escapeHtml_(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    DECISIONS: DECISIONS,
    applyDecision: applyDecision,
    buildDecisionUrl: buildDecisionUrl,
    handleDecisionRequest: handleDecisionRequest
  };
})();
