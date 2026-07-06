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
- Optional: `VENDOR_PRICING_FORM_URL` stores the live frontend `/vendor-pricing` route.
- Frontend hosting uses `NEXT_PUBLIC_MIDTS_GATEWAY_URL=<cloud-run-gateway-url>/webhook`.
- Cloud Run gateway has `MIDTS_WEBHOOK_URL` and `MIDTS_WEBHOOK_TOKEN` configured.
- `setupLaunchSheets()` runs without errors.

## Test 2: Sheet Structure

Run `setupLaunchSheets()`.

Pass condition:

- `Leads` exists.
- `Technical Intake` exists.
- `Technical Reviews` exists.
- `Vendor Safe Packages` exists.
- `Vendor Requests` exists.
- `Vendor Pricing` exists.
- `Webhook Logs` exists.
- `Email Logs` exists.
- `Leads` includes lifecycle, review, document, quote, nurture, vendor, and closure columns.
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

## Test 7: Vendor Safe Package Workspace Slice

Use a qualified lead where `Vendor Safe Package Required = Yes`, `Vendor Safe Package Ready` is not `Yes`, and the latest Technical Review recommendation is `Qualified`.

Pass condition:

- `/workspace/vendor-safe` loads the lead in the pending vendor-safe package queue.
- Package opens `/workspace/vendor-safe/package?leadId=<leadId>`.
- The selected page shows lead, client, company, project type, brief, latest Technical Review context, timeline, and lifecycle stage.
- No editable Lead ID field appears.
- Marking the package ready posts through Cloud Run gateway with `action=recordVendorSafePackage` and `formStage=vendorSafePackage`.
- Gateway rejects missing `leadId` or missing reviewer before forwarding.
- Apps Script reuses `VendorPricingService.markVendorSafePackageReady` and `VendorSafePackageService.preparePackage`.
- `Vendor Safe Packages` receives a row.
- `Leads -> Vendor Safe Package Ready` becomes `Yes`.
- `Leads -> Lifecycle Status` becomes `Vendor Pricing`.
- `Leads -> Vendor Pricing Status` becomes `Contact Vendor`.
- `Webhook Logs` records `vendor_safe_package_success`.
- The lead disappears from `/workspace/vendor-safe` and appears in `/workspace/vendor-request` after refresh.

## Test 8: Vendor Request Setup Workspace Slice

Use a lead in `Lifecycle Status = Vendor Pricing` where vendor pricing is required and no open `Vendor Requests` row exists.

Pass condition:

- `/workspace/vendor-request` loads the lead in the pending vendor request setup queue.
- Setup opens `/workspace/vendor-request/setup?leadId=<leadId>`.
- The selected page shows lead, client, project, package, Technical Review, and lifecycle context.
- No editable Lead ID field appears.
- The reviewer enters only vendor name, vendor email, package link, and vendor-safe file confirmation.
- Submitting posts through Cloud Run gateway with `action=setupVendorRequest` and `formStage=vendorRequestSetup`.
- Gateway rejects missing lead, vendor name, vendor email, package link, or file confirmation before forwarding.
- Apps Script reuses `VendorRequestService.createAndSendRequest`.
- `Vendor Requests` receives a row with `Request Status = Sent`.
- `Leads -> Vendor Pricing Status` becomes `Vendor Request Sent`.
- `Email Logs` records the vendor pricing request email.
- `Webhook Logs` records `vendor_request_setup_success`.
- The lead disappears from `/workspace/vendor-request` after refresh.

## Test 9: Vendor Pricing Response Slice

Use the vendor email link generated by Vendor Request Setup.

Pass condition:

- The vendor email opens `/vendor-pricing?requestId=<requestId>&token=<token>` when `VENDOR_PRICING_FORM_URL` is configured.
- The vendor pricing page submits through Cloud Run gateway with `action=vendorPricing` and `formStage=vendorPricing`.
- Gateway rejects missing request ID, token, or vendor cost before forwarding.
- Apps Script validates the request token hash and reuses `VendorRequestService.handleVendorPricingSubmission`.
- `Vendor Requests` updates to `Submitted` and records vendor commercial fields.
- `Vendor Pricing` receives a row.
- `Leads -> Lifecycle Status` becomes `Margin Review`.
- `Leads -> Vendor Pricing Status` becomes `Pricing Received`.
- `Webhook Logs` records the vendor pricing submission and pricing record.
- `Email Logs` records the next internal workflow email if applicable.

## Test 10: Duplicate Decision Guard

Submit the same Qualification decision again after it has already succeeded.

Pass condition:

- Workspace shows an already-recorded or non-pending state instead of breaking.
- Lead row is not rerouted.
- No second outcome email is sent.
- `Webhook Logs` contains `decision_duplicate` or `qualification_decision_duplicate`.

## Test 11: Conflicting Decision Guard

After one decision has succeeded, submit a different Qualification decision for the same lead.

Pass condition:

- Backend blocks the conflicting decision.
- Lead row keeps the original decision.
- Lead row is not rerouted.
- No second outcome email is sent.
- `Webhook Logs` contains `decision_conflict` or `qualification_decision_blocked`.

## Test 12: Wrong Token

Submit a request to the deployed gateway with an incorrect or missing backend token configuration.

Pass condition:

- Response returns `ok: false` / `success: false`.
- No lifecycle row is created or updated.
- A rejected/failed row appears in `Webhook Logs` when Apps Script receives the request.
- No acknowledgement, internal, outcome, vendor request, or workflow email is sent.

## Test 13: Frontend Submission

Submit the public website form and continue through Step 2, Technical Review, Qualification, Vendor Safe Package, Vendor Request Setup, and Vendor Pricing.

Pass condition:

- Website shows success only after backend success.
- Lead appears in `Leads`.
- Attempt appears in `Webhook Logs`.
- Client acknowledgement appears in `Email Logs` with status `sent`.
- Internal review notification appears in `Email Logs` with status `sent`.
- Step 2-completed lead appears in `/workspace/technical-review`.
- Completed Technical Review appears in `/workspace/qualification`.
- Qualification decision routes the lead without manual sheet editing.
- Vendor-safe and vendor request queues route the lead without manual sheet editing.
- Vendor pricing submission moves the lead to Margin Review.

## Freeze Rule

Do not freeze the lifecycle stage unless these are true:

```text
One Submission ID -> One Lead
One Lead -> One Technical Review
One Technical Review -> One Qualification Decision
One Decision -> One Outcome Email
One Qualified Vendor-Safe Lead -> One Vendor Safe Package
One Vendor Pricing Lead -> One Vendor Request per vendor while open
One Vendor Request -> One Vendor Pricing submission
Repeated decisions do not resend emails
Conflicting decisions are blocked
Every guard writes a visible log
```
