# MIDTS Backend

Clean backend for MIDTS website enquiry capture and launch automation.

## Launch Scope

The first launchable version does one job well:

1. Receive website enquiry submissions from the MIDTS frontend.
2. Validate the shared webhook token.
3. Write a lead row into the Google Sheet.
4. Record every attempt in a webhook log sheet.
5. Return a clear success or failure response.

No quote automation, vendor routing, email sequences, document orchestration, or Apps Script sync complexity is included until lead capture is proven.

## Source Of Truth

GitHub is the source of truth for backend code.

Apps Script is the deployment target only.

## Required Runtime

- Google Apps Script V8 runtime
- Google Sheet for lead storage
- Script Properties for secrets/config

## Required Script Properties

| Key | Purpose |
| --- | --- |
| `WEBSITE_WEBHOOK_TOKEN` | Shared secret expected from the website form payload. |
| `SPREADSHEET_ID` | Optional. If omitted, the script uses the active spreadsheet. |

## Public Endpoint

The deployed Apps Script Web App `/exec` URL is the only URL that should be placed into the frontend build environment.

Frontend hosting must use:

```text
NEXT_PUBLIC_MIDTS_WEBHOOK_URL=<apps-script-exec-url>
NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN=<same-value-as-WEBSITE_WEBHOOK_TOKEN>
```

The frontend variable name and backend property name are intentionally different because the frontend is a build-time public variable and the backend is a private Apps Script property.
