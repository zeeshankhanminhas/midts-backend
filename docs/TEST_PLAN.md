# Launch Test Plan

## Test 1: Script Configuration

Completion state:

- `WEBSITE_WEBHOOK_TOKEN` exists in Apps Script Properties.
- `SPREADSHEET_ID` exists in Apps Script Properties or the script is bound to the launch Google Sheet.
- Optional: `INTAKE_EMAIL` exists in Apps Script Properties if the internal copy should go somewhere other than `intake@midts.com`.
- Optional: `CAPABILITY_STATEMENT_URL` stores the live Capability Statement route.
- Optional: `QUOTE_TEMPLATE_URL` stores the live Quote route.
- `setupLaunchSheets()` runs without errors.

## Test 2: Sheet Structure

Run `setupLaunchSheets()`.

Pass condition:

- `Leads` exists.
- `Webhook Logs` exists.
- `Email Logs` exists.
- `Leads` includes lifecycle, review, document, quote, nurture, and closure columns.

## Test 3: Acknowledgement Email

Run `testAcknowledgementEmail()`.

Pass condition:

- Apps Script asks for email permission if not already approved.
- The active Google account receives the test email.
- A `sent` row appears in `Email Logs`.

## Test 4: Internal Review Notification

Run `testInternalReviewNotification()`.

Pass condition:

- `INTAKE_EMAIL` receives the internal review email, or `intake@midts.com` receives it if no property is set.
- A `sent` row appears in `Email Logs`.

## Test 5: Lifecycle Intake Test

Run `testLifecycleIntakeWithSamplePost()`.

Pass condition:

- Function returns JSON with `ok: true`.
- Response includes `emailStatus: sent`.
- Response includes `internalNotificationStatus: sent`.
- A sample row appears in `Leads`.
- `Lifecycle Status` is `New Lead`.
- `Review Status` is `Pending Review`.
- `Next Action` is `Review lead`.
- A `success` row appears in `Webhook Logs`.
- Two `sent` rows appear in `Email Logs`: client acknowledgement and internal review notification.

## Test 6: Wrong Token

Submit a request to the deployed `/exec` URL using an incorrect token.

Pass condition:

- Response returns `ok: false`.
- Code is `TOKEN_INVALID`.
- No lead row is created.
- A `rejected` row appears in `Webhook Logs`.
- No acknowledgement email is sent.
- No internal review notification is sent.

## Test 7: Frontend Submission

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
- Client acknowledgement appears in `Email Logs` with status `sent`.
- Internal review notification appears in `Email Logs` with status `sent`.
- New lead has visible lifecycle and review status.
