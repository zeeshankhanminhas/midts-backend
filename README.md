# MIDTS Backend

Clean backend for MIDTS website enquiry capture and launch automation.

## Launch Scope

The first launchable version does one controlled lifecycle well:

1. Receive website enquiry submissions from the MIDTS frontend.
2. Validate the shared webhook token.
3. Write a lead row into the Google Sheet.
4. Record every attempt in a webhook log sheet.
5. Send a client acknowledgement email.
6. Send an internal review email with decision links.
7. Record email attempts in an email log sheet.
8. Route human-approved decisions without manual sheet editing.
9. Return a clear success or failure response.

No vendor routing, document generation, dashboard, or Apps Script-only business logic is included until the lead lifecycle is proven.

## Source Of Truth

GitHub is the source of truth for backend code.

Apps Script is the deployment target only.

## Required Runtime

- Google Apps Script V8 runtime
- Google Sheet for lead storage
- Script Properties for secrets/config
- MailApp permission for acknowledgement/internal email

## Required Script Properties

| Key | Purpose |
| --- | --- |
| `WEBSITE_WEBHOOK_TOKEN` | Shared secret expected from the website form payload. |
| `DECISION_TOKEN` | Shared secret used in internal review decision links. |
| `WEB_APP_URL` | Current Apps Script Web App `/exec` URL used to build decision links. |
| `SPREADSHEET_ID` | Optional. If omitted, the script uses the active spreadsheet. |
| `INTAKE_EMAIL` | Optional. Internal notification address. Defaults to `intake@midts.com`. |
| `TEST_EMAIL` | Optional. Recipient for Apps Script test emails. |
| `CAPABILITY_STATEMENT_URL` | Optional. Existing frontend Capability Statement route. |
| `QUOTE_TEMPLATE_URL` | Optional. Existing frontend Quote route. |

## Public Endpoint

The deployed Apps Script Web App `/exec` URL is the only URL that should be placed into the frontend build environment.

Frontend hosting must use:

```text
NEXT_PUBLIC_MIDTS_WEBHOOK_URL=<apps-script-exec-url>
NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN=<same-value-as-WEBSITE_WEBHOOK_TOKEN>
```

Internal review emails use `WEB_APP_URL` and `DECISION_TOKEN` to generate decision links for:

```text
Qualified
Needs More Info
Nurture
Not Suitable
```
