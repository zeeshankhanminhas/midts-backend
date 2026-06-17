var MidtsDecisionService = (function () {
  var DECISIONS = {
    qualified: 'Qualified',
    'needs-more-info': 'Needs More Info',
    nurture: 'Nurture',
    'not-suitable': 'Not Suitable'
  };

  function handleDecisionRequest(e) {
    try {
      var params = e && e.parameter || {};
      var validation = validateDecisionParams_(params);
      if (!validation.ok) {
        return htmlResponse_('MIDTS decision failed', validation.message);
      }

      var result = applyDecision(params.leadId, params.decision, params.reviewer || 'Email Approval');
      if (result.alreadyProcessed) {
        return htmlResponse_('MIDTS decision already recorded', 'Lead ' + result.leadId + ' is already routed as ' + result.decisionLabel + '. No further action was taken.');
      }
      if (result.blocked) {
        return htmlResponse_('MIDTS decision blocked', result.message);
      }

      return htmlResponse_(
        'MIDTS lead decision recorded',
        'Lead ' + result.leadId + ' has been routed as ' + result.decisionLabel + '. Next action: ' + result.nextAction + '. Outcome email: ' + result.outcomeEmailStatus + '.'
      );
    } catch (error) {
      return htmlResponse_('MIDTS decision failed', String(error && error.message ? error.message : error));
    }
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

    var now = new Date();
    var updates = buildDecisionUpdates_(normalizedDecision, decisionLabel, reviewer, now);
    var updatedLead = MidtsSheetService.updateLeadById(leadId, updates);
    var outcomeEmailResult = MidtsEmailService.sendDecisionOutcomeEmail({
      leadId: leadId,
      decision: normalizedDecision,
      decisionLabel: decisionLabel,
      nextAction: updates['Next Action'],
      updates: updates,
      lead: updatedLead.lead
    });

    MidtsLogger.logWebhookAttempt({
      requestId: 'DECISION-' + Utilities.formatDate(now, 'Europe/London', 'yyyyMMddHHmmssSSS'),
      outcome: 'decision',
      message: 'Decision recorded: ' + decisionLabel + '; outcome email: ' + outcomeEmailResult.status,
      payload: {
        leadId: leadId,
        decision: decisionLabel,
        reviewer: reviewer || 'Email Approval',
        outcomeEmailStatus: outcomeEmailResult.status
      },
      submissionId: updatedLead.lead['Submission ID'] || '',
      email: updatedLead.lead['Email'] || '',
      source: 'Decision Link'
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
        reviewer: reviewer || 'Email Approval'
      },
      submissionId: lead['Submission ID'] || '',
      email: lead['Email'] || '',
      source: 'Decision Link'
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

  function validateDecisionParams_(params) {
    if (!params.leadId) {
      return { ok: false, message: 'Missing leadId.' };
    }
    if (!params.decision) {
      return { ok: false, message: 'Missing decision.' };
    }
    if (!params.token) {
      return { ok: false, message: 'Missing decision token.' };
    }
    if (String(params.token) !== MidtsConfig.getDecisionToken()) {
      return { ok: false, message: 'Invalid decision token.' };
    }
    if (!DECISIONS[normalizeDecision_(params.decision)]) {
      return { ok: false, message: 'Unsupported decision: ' + params.decision };
    }
    return { ok: true };
  }

  function buildDecisionUpdates_(decisionKey, decisionLabel, reviewer, now) {
    var base = {
      'Qualification Decision': decisionLabel,
      'Human Approval': 'Approved',
      'Reviewer': reviewer || 'Email Approval',
      'Decision Timestamp': now,
      'Review Status': 'Approved',
      'Last Updated At': now
    };

    if (decisionKey === 'qualified') {
      return Object.assign(base, {
        'Status': 'Qualified',
        'Lifecycle Status': 'Quote Path',
        'Next Action': 'Prepare quote',
        'Next Action Due': now,
        'Quote Required': 'Yes',
        'Quote Reference': createQuoteReference_(now),
        'Quote Status': 'Draft Needed',
        'Capability Statement Required': 'No',
        'Info Request Status': '',
        'Nurture Status': '',
        'Final Outcome': ''
      });
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
      'Info Request Status': '',
      'Nurture Status': '',
      'Final Outcome': 'Not Suitable',
      'Close Reason': 'Marked not suitable from review decision',
      'Closed At': now
    });
  }

  function buildDecisionUrl(leadId, decisionKey) {
    var baseUrl = MidtsConfig.getWebAppUrl();
    var separator = baseUrl.indexOf('?') === -1 ? '?' : '&';
    return baseUrl + separator + [
      'action=decision',
      'leadId=' + encodeURIComponent(leadId),
      'decision=' + encodeURIComponent(decisionKey),
      'token=' + encodeURIComponent(MidtsConfig.getDecisionToken())
    ].join('&');
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
