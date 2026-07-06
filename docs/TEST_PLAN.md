# Launch Test Plan

## Test 1: Script Configuration

Completion state:

- `WEBSITE_WEBHOOK_TOKEN` exists in Apps Script Properties.
- `DECISION_TOKEN` exists in Apps Script Properties for Apps Script fallback links.
- `WEB_APP_URL` exists in Apps Script Properties and is the current `/exec` URL.
- `SPREADSHEET_ID` exists in Apps Script Properties or the script is bound to the launch Google Sheet.
- Optional: `INTAKE_EMAIL` exists in Apps Script Properties if the internal copy should go somewhere other than `intake@midts.com`.
- Optional: `TEST_EMAIL` exists for Apps Script test emails.
- Optional: `CAPABILITY_STATEMENT_URL` stores the live Capability Statement route.
- Optional: `QUOTE_TEMPLATE_URL` stores the live Quote route.
- Frontend hosting uses `NEXT_PUBLIC_MIDTS_GATEWAY_URL=<cloud-run-gateway-url>/webhook`.
- Cloud Run gateway has `MIDTS_WEBHOOK_URL` and `MIDTS_WEBHOOK_TOKEN` configured.
- `setupLaunchSheets()` runs without errors.

## Test 2: Sheet Structure

Run `setupLaunchSheets()`.

Pass condition:

- `Leads` exists.
- `Technical Intake` exists.
- `Technical Reviews` exists.
- `Webhook Logs` exists.
- `Email Logs` exists.
- `Leads` includes lifecycle, review, document, quote, nurture, and closure columns.
- `Technical Reviews` includes the assessment, risk, clarification, recommendation, and internal notes fields used by Workspace.

## Test 3: Lifecycle Intake Test

Run `testLifecycleIntakeWithSamplePost()`.

Pass condition:

- Function returns JSON with `ok: true`.
- Response includes `emailStatus: sent`.
- Response includes `internalNotificationStatus: sent`.
- A sample row appears in `Leads`.
- Step 2 completion moves the lead to `Lifecycle Status = Pending Review`.
- `Review Status` is `Pending Review`.
- `Next Action` is `Review technical requirement`.
- A `success` or `step2_success` row appears in `Webhook Logs`.
- `Email Logs` contains client acknowledgement and internal review notification rows.

## Test 4: Duplicate Submission Guard

Submit the same payload twice with the same `Submission ID`.

Pass condition:

- Only one row exists in `Leads` for that `Submission ID`.
- Second response returns `duplicate: true`.
- Second response returns the existing `Lead ID`.
- Second attempt writes `Webhook Logs -> outcome = duplicate`.
- Second attempt does not send another acknowledgement email.
- Second attempt does not send another internal review notification.

## Test 5: Technical Review Workspace Slice

Use a lead that has completed Step 2 and has no completed technical review.

Pass condition:

- `/workspace/technical-review` loads the lead in the pending queue.
- No seeded/demo records appear when live backend data is returned.
- Review opens `/workspace/technical-review/review?leadId=<leadId>`.
- The selected page shows lead, client, company, project type, brief, technical intake, uploaded files, timeline, and lifecycle stage.
- No editable Lead ID field appears.
- Submitting Technical assessment, Risks, Clarifications, Internal notes, and Recommendation posts through Cloud Run gateway with `action=recordTechnicalReview` and `formStage=technicalReview`.
- `Technical Reviews` receives a row.
- `Leads -> Review Status` becomes `Technical Review Complete`.
- `Webhook Logs` records `technical_review_success`.
- The lead disappears from the pending technical review queue after refresh.

## Test 6: Qualification Decision Workspace Slice

Use a lead that has a completed Technical Review and no Qualification Decision / Human Approval.

Pass condition:

- `/workspace/qualification` loads the lead in the pending Qualification queue.
- Decision opens `/workspace/qualification/review?leadId=<leadId>`.
- The selected page shows lead context and the latest Technical Review summary, risks, clarifications, internal notes, and recommendation.
- No editable Lead ID field appears.
- Selecting one of `Qualified`, `Needs More Information`, `Nurture`, or `Not Suitable` posts through Cloud Run gateway with `action=recordQualificationDecision` and `formStage=qualificationDecision`.
- Gateway rejects missing `leadId`, missing `decision`, unsupported `decision`, or missing `reviewer` before forwarding.
- Apps Script uses `DecisionService.applyDecision` for the existing lifecycle update, duplicate/conflict guards, outcome email, and logs.
- Success appears only after backend success.
- The lead row updates automatically.
- `Qualification Decision` matches the selected decision.
- `Human Approval` is `Approved`.
- `Review Status` is `Approved`.
- `Decision Timestamp` is populated.
- `Next Action` matches the decision route.
- `Webhook Logs` contains `qualification_decision_success` or the existing DecisionService decision log.
- `Email Logs` contains the correct outcome email row.
- The lead disappears from the pending Qualification queue after refresh.

Decision-specific pass conditions:

```text
Qualified -> Lifecycle Status = Vendor Safe Review or Vendor Pricing, Quote Required = Yes, Vendor Pricing Required = Yes, internal workflow email sent if applicable
Needs More Information -> Lifecycle Status = Info Required, Info Request Status = Required, client info request email sent
Nurture -> Lifecycle Status = Nurture, Nurture Status = Scheduled, Next Nurture Date populated, client nurture email sent
Not Suitable -> Lifecycle Status = Closed, Final Outcome = Not Suitable, Closed At populated, client decline email sent
```

## Test 7: Duplicate Decision Guard

Submit the same Qualification decision again after it has already succeeded.

Pass condition:

- Workspace shows an already-recorded or non-pending state instead of breaking.
- Lead row is not rerouted.
- No second outcome email is sent.
- `Webhook Logs` contains `decision_duplicate` or `qualification_decision_duplicate`.

## Test 8: Conflicting Decision Guard

After one decision has succeeded, submit a different Qualification decision for the same lead.

Pass condition:

- Backend blocks the conflicting decision.
- Lead row keeps the original decision.
- Lead row is not rerouted.
- No second outcome email is sent.
- `Webhook Logs` contains `decision_conflict` or `qualification_decision_blocked`.

## Test 9: Wrong Token

Submit a request to the deployed gateway with an incorrect or missing backend token configuration.

Pass condition:

- Response returns `ok: false` / `success: false`.
- No lifecycle row is created or updated.
- A rejected/failed row appears in `Webhook Logs` when Apps Script receives the request.
- No acknowledgement, internal, or outcome email is sent.

## Test 10: Frontend Submission

Submit the public website form and continue through Step 2, Technical Review, and Qualification.

Pass condition:

- Website shows success only after backend success.
- Lead appears in `Leads`.
- Attempt appears in `Webhook Logs`.
- Client acknowledgement appears in `Email Logs` with status `sent`.
- Internal review notification appears in `Email Logs` with status `sent`.
- Step 2-completed lead appears in `/workspace/technical-review`.
- Completed Technical Review appears in `/workspace/qualification`.
- Qualification decision routes the lead without manual sheet editing.
- The decision route sends/logs the appropriate outcome email.

## Freeze Rule

Do not freeze the lifecycle stage unless these are true:

```text
One Submission ID -> One Lead
One Lead -> One Technical Review
One Technical Review -> One Qualification Decision
One Decision -> One Outcome Email
Repeated decisions do not resend emails
Conflicting decisions are blocked
Every guard writes a visible log
```
