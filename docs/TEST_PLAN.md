# Launch Test Plan

## Test 1: Script Configuration

Completion state:

- `WEBSITE_WEBHOOK_TOKEN` exists in Apps Script Properties.
- `SPREADSHEET_ID` exists in Apps Script Properties or the script is bound to the launch Google Sheet.
- `setupLaunchSheets()` runs without errors.

## Test 2: Manual Lead Write

Run `testWebsiteWebhookWithSampleLead()`.

Pass condition:

- A sample row appears in `Leads`.

## Test 3: Router Test

Run `testWebhookRouterWithSamplePost()`.

Pass condition:

- Function returns JSON with `ok: true`.
- A sample row appears in `Leads`.
- A `success` row appears in `Webhook Logs`.

## Test 4: Wrong Token

Submit a request to the deployed `/exec` URL using an incorrect token.

Pass condition:

- Response returns `ok: false`.
- Code is `TOKEN_INVALID`.
- No lead row is created.
- A `rejected` row appears in `Webhook Logs`.

## Test 5: Frontend Submission

Set frontend hosting variables:

```text
NEXT_PUBLIC_MIDTS_WEBHOOK_URL=<new-apps-script-exec-url>
NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN=<same-value-as-WEBSITE_WEBHOOK_TOKEN>
```

Submit the public website form.

Pass condition:

- Website shows success only after backend success.
- Lead appears in `Leads`.
- Attempt appears in `Webhook Logs`.
