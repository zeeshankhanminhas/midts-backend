# MIDTS PDF Renderer

Cloud Run service that renders the deployed MIDTS quote template to an A4 PDF.

## Endpoint

`POST /render/pdf`

Required header:

```
Authorization: Bearer <RENDERER_TOKEN>
```

Body accepts exactly one value:

```json
{ "url": "https://zeeshankhanminhas.github.io/NEW-MIDTS/documents/quote/..." }
```

The service only accepts URLs beginning with `ALLOWED_QUOTE_PREFIX`.

## Deploy

From the `renderer` directory after authenticating with Google Cloud:

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/midts-pdf-renderer
gcloud run deploy midts-pdf-renderer \
  --image gcr.io/PROJECT_ID/midts-pdf-renderer \
  --region europe-west2 \
  --no-allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 60s \
  --set-env-vars ALLOWED_QUOTE_PREFIX=https://zeeshankhanminhas.github.io/NEW-MIDTS/documents/quote/
```

Set `RENDERER_TOKEN` as a Cloud Run secret or environment variable. Do not commit it.

The Apps Script backend will call this endpoint with the approved quote URL, save the returned PDF to the lead's Drive `Quotes` folder, and update the `Documents` register.
