import express from 'express';
import { chromium } from 'playwright';

const app = express();
const port = Number(process.env.PORT || 8080);
const rendererToken = process.env.RENDERER_TOKEN || '';
const allowedQuotePrefix = String(process.env.ALLOWED_QUOTE_PREFIX || '').trim();
const maxRenderMs = Number(process.env.MAX_RENDER_MS || 45000);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_request, response) => {
  response.json({ ok: true, service: 'midts-pdf-renderer' });
});

app.post('/render/pdf', async (request, response) => {
  if (!isAuthorized(request)) {
    return response.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const { url, html } = request.body || {};
  if ((url && html) || (!url && !html)) {
    return response.status(400).json({ ok: false, error: 'Provide exactly one of url or html.' });
  }
  if (url && !isAllowedQuoteUrl(url)) {
    return response.status(400).json({ ok: false, error: 'Only the configured MIDTS quote URL may be rendered.' });
  }
  if (html && typeof html !== 'string') {
    return response.status(400).json({ ok: false, error: 'html must be a string.' });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });

    if (url) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: maxRenderMs });
    } else {
      await page.setContent(html, { waitUntil: 'networkidle', timeout: maxRenderMs });
    }

    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    response
      .status(200)
      .set('Content-Type', 'application/pdf')
      .set('Content-Disposition', 'inline; filename="midts-quote.pdf"')
      .set('Cache-Control', 'no-store')
      .send(pdf);
  } catch (error) {
    response.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'PDF rendering failed.' });
  } finally {
    if (browser) await browser.close();
  }
});

function isAuthorized(request) {
  if (!rendererToken) return false;
  const authorization = String(request.get('authorization') || '');
  return authorization === 'Bearer ' + rendererToken;
}

function isAllowedQuoteUrl(url) {
  return Boolean(allowedQuotePrefix) && typeof url === 'string' && url.startsWith(allowedQuotePrefix);
}

app.listen(port, () => {
  console.log('MIDTS PDF renderer listening on port ' + port);
});
