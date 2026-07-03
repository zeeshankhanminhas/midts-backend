import express from 'express';

const app = express();
const port = process.env.PORT || 8080;
const webhookUrl = process.env.MIDTS_WEBHOOK_URL || '';
const webhookToken = process.env.MIDTS_WEBHOOK_TOKEN || '';
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

function originAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
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

function validatePayload(payload) {
  const stage = firstString(payload, ['formStage', 'form_stage', 'stage']).toLowerCase();
  const action = firstString(payload, ['action']).toLowerCase();

  if (stage === 'technicalreview' || stage === 'technical-review' || stage === 'technical_review' || action === 'recordtechnicalreview' || action === 'record-technical-review' || action === 'record_technical_review') {
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

  if (stage === 'vendorpricing' || action === 'vendorpricing') {
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
app.post('/lead', handleWebhook);

app.listen(port, () => {
  console.log(`MIDTS form gateway listening on port ${port}`);
});