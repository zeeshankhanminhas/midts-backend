# MIDTS Cloud Run Gateway

Public-safe Cloud Run service for website form submissions.

## Flow

Frontend -> Cloud Run Gateway -> Apps Script `/exec` -> Google Sheets/email

The frontend only sees the gateway URL. The Apps Script URL and webhook token stay server-side.

## Endpoints

- `GET /health`
- `POST /webhook`
- `POST /lead` alias for `/webhook`

## Environment variables

- `MIDTS_WEBHOOK_URL` - deployed Apps Script `/exec` URL
- `MIDTS_WEBHOOK_TOKEN` - same value as Apps Script `WEBSITE_WEBHOOK_TOKEN`
- `ALLOWED_ORIGINS` - comma-separated frontend origins, for example `https://zeeshankhanminhas.github.io`
- `PORT` - provided by Cloud Run, defaults to `8080`

## Deploy

From this `gateway` directory:

`gcloud run deploy midts-form-gateway --source . --region europe-west2 --allow-unauthenticated --min-instances 0 --max-instances 2 --memory 256Mi --cpu 1 --timeout 30s`

Set `MIDTS_WEBHOOK_URL`, `MIDTS_WEBHOOK_TOKEN`, and `ALLOWED_ORIGINS` as Cloud Run environment variables or secrets.
