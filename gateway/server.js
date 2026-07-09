import express from 'express';

const app = express();
const port = process.env.PORT || 8080;
const webhookUrl = process.env.MIDTS_WEBHOOK_URL || '';
const webhookToken = process.env.MIDTS_WEBHOOK_TOKEN || '';
const uploadPayloadLimit = process.env.MIDTS_UPLOAD_PAYLOAD_LIMIT || '50mb';
const defaultAllowedOrigins = [
  'https://new-midts.vercel.app',
  'https://zeeshankhanminhas.github.io',
];
const configuredAllowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]));
const workspaceReadActionAliases = {
  listpendingtechnicalreviews: 'listPendingTechnicalReviews',
  pendingtechnicalreviews: 'listPendingTechnicalReviews',
  listtechnicalreviews: 'listPendingTechnicalReviews',
  listpendingqualificationdecisions: 'listPendingQualificationDecisions',
  listpendingqualificationdecision: 'listPendingQualificationDecisions',
  pendingqualificationdecisions: 'listPendingQualificationDecisions',
  pendingqualificationdecision: 'listPendingQualificationDecisions',
  listqualificationdecisions: 'listPendingQualificationDecisions',
  listqualificationdecision: 'listPendingQualificationDecisions',
  listpendingvendorsafepackages: 'listPendingVendorSafePackages',
  listpendingvendorsafepackage: 'listPendingVendorSafePackages',
  pendingvendorsafepackages: 'listPendingVendorSafePackages',
  listpendingvendorrequestsetups: 'listPendingVendorRequestSetups',
  listpendingvendorrequestsetup: 'listPendingVendorRequestSetups',
  pendingvendorrequestsetups: 'listPendingVendorRequestSetups',
  listpendingmarginreviews: 'listPendingMarginReviews',
  listpendingmarginreview: 'listPendingMarginReviews',
  pendingmarginreviews: 'listPendingMarginReviews',
  pendingmarginreview: 'listPendingMarginReviews',
  listpendingquotebuilders: 'listPendingQuoteBuilders',
  listpendingquotebuilder: 'listPendingQuoteBuilders',
  listpendingquotebuilderrecords: 'listPendingQuoteBuilders',
  pendingquotebuilders: 'listPendingQuoteBuilders',
};
const workspaceReadActions = Object.keys(workspaceReadActionAliases);

app.disable('x-powered-by');
app.use(express.json({ limit: uploadPayloadLimit }));
app.use(express.urlencoded({ extended: true, limit: uploadPayloadLimit }));

function originAllowed(origin) {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (originAllowed(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin || '*');
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(originAllowed(origin) ? 204 : 403).end();
    return;
  }

  if (!originAllowed(origin)) {
    response.status(403).json({ success: false, message: 'Origin is not allowed.' });
    return;
  }

  next();
});

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'midts-form-gateway',
    configured: Boolean(webhookUrl && webhookToken),
  });
});

function firstString(payload, names) {
  for (const name of names) {
    const value = payload[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
}

function normalizedCompact(value) {
  return normalized(value).replace(/-/g, '');
}

function canonicalWorkspaceReadAction(value) {
  return workspaceReadActionAliases[normalizedCompact(value)] || '';
}

function allowedMarginAction(value) {
  return ['approvemargin', 'updatemarginreview', 'rejectmargin', 'returnmargintovendor'].includes(normalizedCompact(value));
}

function validatePayload(payload) {
  const stage = firstString(payload, ['formStage', 'form_stage', 'stage']).toLowerCase();
  const action = firstString(payload, ['action']).toLowerCase();
  const compactStage = normalizedCompact(stage);
  const compactAction = normalizedCompact(action);

  if (compactStage === 'workspaceread' || workspaceReadActions.includes(compactAction)) {
    const canonicalAction = canonicalWorkspaceReadAction(action);
    if (!canonicalAction) return `Unsupported workspace read action: ${action || '[missing]'}.`;
    payload.action = canonicalAction;
    return '';
  }

  if (compactStage === 'marginreview' || allowedMarginAction(action)) {
    if (!firstString(payload, ['leadId', 'lead_id'])) return 'Missing lead reference.';
    if (!firstString(payload, ['reviewer', 'actor'])) return 'Missing reviewer.';
    if (action && !allowedMarginAction(action)) return 'Unsupported margin review action.';
    if (compactAction === 'updatemarginreview' && !firstString(payload, ['marginValue', 'margin_value'])) return 'Missing margin value.';
    return '';
  }

  if (compactStage === 'vendorsafepackage' || compactAction === 'recordvendorsafepackage') {
    if (!firstString(payload, ['leadId', 'lead_id'])) return 'Missing lead reference.';
    if (!firstString(payload, ['reviewer', 'actor'])) return 'Missing reviewer.';
    return '';
  }

  if (compactStage === 'vendorrequestsetup' || compactAction === 'setupvendorrequest') {
    if (!firstString(payload, ['leadId', 'lead_id'])) return 'Missing lead reference.';
    if (!firstString(payload, ['vendorName', 'vendor_name'])) return 'Missing vendor name.';
    if (!firstString(payload, ['vendorEmail', 'vendor_email'])) return 'Missing vendor email.';
    if (!firstString(payload, ['packageLink', 'package_link'])) return 'Missing vendor-safe package link.';
    if (firstString(payload, ['vendorSafeFilesConfirmed', 'vendor_safe_files_confirmed']).toLowerCase() !== 'yes') return 'Vendor-safe files confirmation is required.';
    return '';
  }

  if (compactStage === 'qualificationdecision' || compactAction === 'recordqualificationdecision') {
    if (!firstString(payload, ['leadId', 'lead_id'])) return 'Missing lead reference.';
    if (!firstString(payload, ['decision'])) return 'Missing qualification decision.';
    if (!allowedQualificationDecision(firstString(payload, ['decision']))) return 'Unsupported qualification decision.';
    if (!firstString(payload, ['reviewer', 'actor'])) return 'Missing reviewer.';
    return '';
  }

  if (compactStage === 'technicalreview' || compactAction === 'recordtechnicalreview') {
    if (!firstString(payload, ['leadId', 'lead_id'])) return 'Missing lead reference.';
    if (!firstString(payload, ['reviewer'])) return 'Missing reviewer.';
    if (!firstString(payload, ['reviewSummary', 'review_summary'])) return 'Missing review summary.';
    if (!firstString(payload, ['recommendation'])) return 'Missing recommendation.';
    return '';
  }

  if (stage === 'step2' || stage === 'step_2' || stage === 'technical-intake' || stage === 'technical_intake') {
    if (!firstString(payload, ['leadId', 'lead_id'])) return 'Missing lead reference.';
    if (!firstString(payload, ['technicalRequirement', 'technicalScope', 'briefRequirement', 'brief_requirement'])) return 'Missing technical requirement.';
    return '';
  }

  if (compactStage === 'vendorpricing' || compactAction === 'vendorpricing') {
    if (!firstString(payload, ['requestId', 'request_id'])) return 'Missing vendor request reference.';
    if (!firstString(payload, ['token'])) return 'Missing vendor request token.';
    if (!firstString(payload, ['vendorCost', 'vendor_cost'])) return 'Missing vendor cost.';
    return '';
  }

  if (action === 'quoteresponse') {
    if (!firstString(payload, ['responseId', 'response_id'])) return 'Missing quote response reference.';
    if (!firstString(payload, ['token'])) return 'Missing quote access token.';
    if (!firstString(payload, ['outcome'])) return 'Missing quote response outcome.';
    return '';
  }

  if (stage === 'quote_acceptance' || action === 'getquote' || action === 'acceptquote' || action === 'rejectquote') {
    if (!firstString(payload, ['quoteId', 'quote_id'])) return 'Missing quote reference.';
    if (!firstString(payload, ['token'])) return 'Missing quote access token.';
    return '';
  }

  if (!firstString(payload, ['fullName', 'full_name', 'name', 'yourName'])) return 'Missing full name.';
  if (!firstString(payload, ['email', 'work_email', 'emailAddress', 'email_address'])) return 'Missing email.';
  if (!firstString(payload, ['briefRequirement', 'brief_requirement', 'message', 'projectBrief'])) return 'Missing brief requirement.';
  return '';
}

function allowedQualificationDecision(value) {
  const normalizedValue = normalized(value);
  return ['qualified', 'needs-more-info', 'nurture', 'not-suitable'].includes(normalizedValue);
}

async function forwardToAppsScript(payload) {
  const normalizedAction = normalizeLegacyAction(payload);
  if (normalizedAction) {
    const legacyPayload = new URLSearchParams({ ...stringifyValues(payload), action: normalizedAction });
    const upstreamResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: legacyPayload.toString(),
      redirect: 'follow',
    });

    return {
      status: upstreamResponse.status,
      body: await parseUpstreamBody(upstreamResponse),
    };
  }

  const upstreamResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, webhookToken }),
    redirect: 'follow',
  });

  return {
    status: upstreamResponse.status,
    body: await parseUpstreamBody(upstreamResponse),
  };
}

function stringifyValues(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]),
  );
}

function normalizeLegacyAction(payload) {
  const stage = firstString(payload, ['formStage', 'form_stage', 'stage']).toLowerCase();
  const action = firstString(payload, ['action']);
  const normalizedAction = action.toLowerCase();

  if (stage === 'vendorpricing' || normalizedAction === 'vendorpricing') return 'vendorPricing';
  if (normalizedAction === 'quoteresponse') return 'quoteResponse';
  return '';
}

async function parseUpstreamBody(upstreamResponse) {
  const contentType = upstreamResponse.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return upstreamResponse.json().catch(() => ({}));
  }

  const text = await upstreamResponse.text();
  return {
    success: false,
    message: upstreamResponse.ok
      ? 'Apps Script returned a non-JSON response.'
      : `Apps Script request failed with HTTP ${upstreamResponse.status}.`,
    upstreamContentType: contentType,
    upstreamPreview: text.slice(0, 500),
  };
}

async function handleWebhook(request, response) {
  if (!webhookUrl || !webhookToken) {
    response.status(500).json({ success: false, message: 'Gateway is not configured.' });
    return;
  }

  const payload = request.body && typeof request.body === 'object' ? request.body : {};
  const validationError = validatePayload(payload);
  if (validationError) {
    response.status(400).json({ success: false, message: validationError });
    return;
  }

  try {
    const upstream = await forwardToAppsScript(payload);
    response.status(upstream.status).json(upstream.body);
  } catch {
    response.status(502).json({ success: false, message: 'MIDTS automation backend could not be reached.' });
  }
}

app.post('/webhook', handleWebhook);

app.listen(port, () => {
  console.log(`MIDTS gateway listening on ${port}`);
});
