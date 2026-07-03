# MIDTS PDF Renderer

Cloud Run service that renders controlled MIDTS quote source content to an A4 PDF.

The renderer must not be configured to render public `/documents/*` template routes.

## Endpoint

`POST /render/pdf`

Required header:

```
Authorization: Bearer <RENDERER_TOKEN>
```

Body accepts exactly one value:

```json
{ "html": "<controlled quote HTML>" }
```

or, only when authenticated workspace rendering is explicitly available:

```json
{ "url": "https://<frontend-domain>/workspace/documents/quote?..." }
```

The service only accepts URL rendering when `ALLOWED_QUOTE_PREFIX` is explicitly configured. If `ALLOWED_QUOTE_PREFIX` is blank, URL rendering is disabled and controlled HTML rendering remains available.

## Deploy

From the `renderer` directory after authenticating with Google Cloud:

```bash
gcloud run deploy midts-pdf-renderer \
  --source . \
  --region europe-west2 \
  --no-allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 60s \
  --set-env-vars ALLOWED_QUOTE_PREFIX=https://<frontend-domain>/workspace/documents/quote
```

Set `RENDERER_TOKEN` as a Cloud Run secret or environment variable. Do not commit it.

Do not set `ALLOWED_QUOTE_PREFIX` to a public `/documents/*` route.

The Apps Script backend will call this endpoint with controlled quote source content, save the returned PDF to the lead's Drive `Quotes` folder, and update the `Documents` register.
