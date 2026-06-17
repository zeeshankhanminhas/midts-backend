# Launch Test Plan

## Test 1: Script Configuration

Completion state:

- `WEBSITE_WEBHOOK_TOKEN` exists in Apps Script Properties.
- `DECISION_TOKEN` exists in Apps Script Properties.
- `WEB_APP_URL` exists in Apps Script Properties and is the current `/exec` URL.
- `SPREADSHEET_ID` exists in Apps Script Properties or the script is bound to the launch Google Sheet.
- Optional: `INTAKE_EMAIL` exists in Apps Script Properties if the internal copy should go somewhere other than `intake@midts.com`.
- Optional: `TEST_EMAIL` exists for Apps Script test emails.
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

## Test 3: Lifecycle Intake Test

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
- Internal review email includes four decision links.

## Test 4: Duplicate Submission Guard

Submit the same payload twice with the same `Submission ID`.

Pass condition:

- Only one row exists in `Leads` for that `Submission ID`.
- Second response returns `duplicate: true`.
- Second response returns the existing `Lead ID`.
- Second attempt writes `Webhook Logs -> outcome = duplicate`.
- Second attempt does not send another acknowledgement email.
- Second attempt does not send another internal review notification.

## Test 5: Decision Link And Outcome Email

Use a fresh lifecycle test lead for each decision.

Click one internal review decision link.

Pass condition:

- Browser shows `MIDTS lead decision recorded`.
- Browser message includes `Outcome email: sent`.
- The matching lead row updates automatically.
- `Qualification Decision` matches the clicked decision.
- `Human Approval` is `Approved`.
- `Review Status` is `Approved`.
- `Decision Timestamp` is populated.
- `Next Action` matches the decision route.
- `Webhook Logs` contains `Decision recorded`.
- `Email Logs` contains the correct outcome email row.

Decision-specific pass conditions:

```text
Qualified -> Lifecycle Status = Quote Path, Quote Required = Yes, Quote Status = Draft Needed, internal quote prep email sent
Needs More Info -> Lifecycle Status = Info Required, Info Request Status = Required, client info request email sent
Nurture -> Lifecycle Status = Nurture, Nurture Status = Scheduled, Next Nurture Date populated, client nurture email sent
Not Suitable -> Lifecycle Status = Closed, Final Outcome = Not Suitable, Closed At populated, client decline email sent
```

## Test 6: Duplicate Decision Guard

Click the same decision link again after it has already succeeded.

Pass condition:

- Browser shows `MIDTS decision already recorded`.
- Lead row is not rerouted.
- No second outcome email is sent.
- `Webhook Logs` contains `outcome = decision_duplicate`.

## Test 7: Conflicting Decision Guard

After one decision has succeeded, click a different decision link for the same lead.

Pass condition:

- Browser shows `MIDTS decision blocked`.
- Lead row keeps the original decision.
- Lead row is not rerouted.
- No second outcome email is sent.
- `Webhook Logs` contains `outcome = decision_conflict`.

## Test 8: Wrong Token

Submit a request to the deployed `/exec` URL using an incorrect token.

Pass condition:

- Response returns `ok: false`.
- Code is `TOKEN_INVALID`.
- No lead row is created.
- A `rejected` row appears in `Webhook Logs`.
- No acknowledgement email is sent.
- No internal review notification is sent.

## Test 9: Frontend Submission

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
- Clicking an internal review decision link routes the lead without manual sheet editing.
- The decision route sends/logs the appropriate outcome email.

## Freeze Rule

Do not freeze the lifecycle stage unless these are true:

```text
One Submission ID -> One Lead
One Lead -> One Human Decision
One Decision -> One Outcome Email
Repeated clicks do not resend emails
Conflicting clicks are blocked
Every guard writes a visible log
```
