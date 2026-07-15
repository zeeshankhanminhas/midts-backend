# MIDTS Commercial Launch Sprints

Last updated: 2026-07-15

The commercial launch path is split into eight focused sprints. Each sprint must keep the existing architecture: Workspace controls business UI, the gateway remains the integration boundary, Apps Script remains the backend/data/document transport layer, and public marketing routes stay unchanged.

## Sprint 1 - Production Workspace Auth

Goal: replace preview Workspace access with server-side session protection.

Minimum acceptance:

- Workspace routes are blocked before React renders.
- Login uses server-side credentials, not hard-coded browser credentials.
- Session is stored in a signed HTTP-only cookie.
- Logout clears the signed session cookie.
- Public routes remain unchanged.
- Required deployment variables are documented.

Status: frontend implementation is on `sprint/1-production-workspace-auth` in `zeeshankhanminhas/NEW-MIDTS`. No Apps Script/backend service change is required for this sprint.

Required frontend environment variables:

- `WORKSPACE_AUTH_EMAIL`
- `WORKSPACE_AUTH_SECRET`
- `WORKSPACE_AUTH_PASSWORD_SHA256` preferred, or `WORKSPACE_AUTH_PASSWORD` as a fallback

Generate a SHA-256 password hash outside the app and store only `WORKSPACE_AUTH_PASSWORD_SHA256` for production.

## Sprint 2 - Quote PDF Live Hardening

Goal: verify and harden approved quote PDF generation through the Workspace Document Suite render path.

Minimum acceptance:

- `PDF_RENDERER_URL` and `PDF_RENDERER_TOKEN` are set in production.
- Quote draft approval generates a PDF from `/workspace/documents/quote`.
- Generated PDF is stored in Drive.
- `Documents`, `Leads`, and `Webhook Logs` update consistently.
- Useful errors are shown in Workspace when render fails.

Status: implemented on `sprint/2-quote-pdf-live-hardening`, pending Apps Script deployment and live verification.

Implementation notes:

- `approveQuoteDraft` signs the approved Workspace quote document URL before calling the PDF renderer.
- The signed URL is short-lived and valid only for the selected lead and quote reference.
- `PdfRenderService` reports missing renderer configuration, renderer HTTP failures, HTML responses, empty payloads, and Drive storage failures clearly.
- `recordTechnicalReview`, quote builder, and existing gateway contracts are unchanged.

Required Apps Script properties:

- `PDF_RENDERER_URL`
- `PDF_RENDERER_TOKEN`
- `QUOTE_RENDER_SECRET` matching the frontend Vercel `QUOTE_RENDER_SECRET`

Deployment verification:

- Deploy Apps Script after setting `QUOTE_RENDER_SECRET`.
- Confirm quote approval writes a PDF file to Drive.
- Confirm the `Documents` row receives `PDF File ID` and `PDF Drive URL`.
- Confirm the `Leads` row moves to `Quote Approved` / `Approved to Send`.
- Confirm `Webhook Logs` records `quote_approved_pdf_generated` on success or a clear `QUOTE_PDF_RENDER_FAILED` failure.

## Sprint 3 - Send Approved Quote

Goal: add a Workspace-controlled action to send the generated approved quote to the client.

Minimum acceptance:

- Approved quote PDF can be sent from Workspace.
- Client email is sent and logged.
- Lead moves to `Quote Sent` / waiting acceptance state.
- `Documents` status is marked `Sent`.
- `Email Logs` and `Webhook Logs` record success/failure.

Status: implemented on `sprint/3-send-approved-quote`, pending Apps Script deployment and live verification.

Implementation notes:

- `MidtsQuoteSendService.listPendingApprovedQuotes()` exposes quotes where the lead is `Quote Approved` and `Approved to Send`, and the latest quote snapshot has a generated PDF.
- `MidtsQuoteSendService.sendApprovedQuote()` sends the approved PDF as an email attachment through `MidtsEmailService.sendApprovedQuoteEmail()`.
- Successful send updates `Documents.Status` to `Sent`, sets `Sent At` and `Sent To`, and updates the lead to `Quote Sent`, `Sent to Client`, `Await client acceptance`.
- `Email Logs` records sent/failed email attempts and `Webhook Logs` records `quote_sent_to_client` on success.

Deployment verification:

- Deploy Apps Script after Sprint 3 backend changes.
- Confirm `listPendingApprovedQuotes` returns approved quotes with generated PDFs.
- Send one approved quote from Workspace.
- Confirm the client receives the PDF attachment.
- Confirm `Documents`, `Leads`, `Email Logs`, and `Webhook Logs` update consistently.

## Sprint 4 - Client Quote Acceptance

Goal: record client acceptance of a sent quote.

Minimum acceptance:

- Client or Workspace acceptance action exists.
- Lead moves to `Quote Accepted` / `Accepted`.
- Acceptance actor, timestamp, and source are audited.
- Duplicate acceptance is idempotent.

Status: implemented on `sprint/4-client-quote-acceptance`, pending Apps Script deployment and live verification.

Implementation notes:

- `MidtsQuoteAcceptanceService.listPendingQuoteAcceptances()` exposes sent quotes waiting for acceptance.
- `MidtsQuoteAcceptanceService.acceptQuote()` records acceptance in `Quote Acceptances`, updates `Leads`, and logs `quote_accepted`.
- Duplicate acceptance is idempotent when the lead is already `Quote Accepted` / `Accepted`.
- Successful acceptance sets `Lifecycle Status = Quote Accepted`, `Quote Status = Accepted`, `Human Approval = Approved`, `Final Outcome = Quote Accepted`, and `Next Action = Create project`.
- This state is the existing input expected by `MidtsProjectService.createProjectFromAcceptedQuote()`.

Deployment verification:

- Deploy Apps Script after Sprint 4 backend changes.
- Confirm `listPendingQuoteAcceptances` returns sent quotes.
- Record one acceptance from Workspace.
- Confirm `Quote Acceptances`, `Leads`, and `Webhook Logs` update consistently.
- Confirm the accepted lead is ready for Project Creation.

## Sprint 5 - Project Creation

Goal: expose project creation from accepted quote through Workspace and gateway.

Minimum acceptance:

- Accepted quote appears in a Project Creation queue.
- Workspace action calls existing backend project creation logic.
- Project row is created.
- Lead moves to `Project Active`.
- Drive/project folder and source document link are recorded.

Status: implemented on `sprint/5-project-creation`, pending Apps Script deployment and live verification.

Implementation notes:

- `MidtsProjectService.listPendingProjectCreations()` exposes accepted quotes that do not already have a project.
- `MidtsProjectService.createProjectFromAcceptedQuote()` remains the project creation operation and now returns project/folder/source-document context for Workspace.
- The router accepts `action=listPendingProjectCreations`, `formStage=workspaceRead` for queue reads.
- The router accepts `action=createProjectFromAcceptedQuote`, `formStage=projectCreation` for the selected Workspace action.
- Successful creation writes `Projects`, updates the lead to `Project Active`, records the Drive folder, source quote document ID, and `Webhook Logs` entry.

Deployment verification:

- Deploy Apps Script after Sprint 5 backend changes.
- Confirm `listPendingProjectCreations` returns accepted quotes without existing project rows.
- Create one project from Workspace.
- Confirm `Projects`, `Leads`, Drive folder, source quote document ID, and `Webhook Logs` update consistently.

## Sprint 6 - Document Suite / VSP Alignment

Goal: resolve the Vendor Safe Package document-engine mismatch.

Minimum acceptance:

- Either VSP generated documents move to the Workspace Document Suite snapshot/rendering model, or
- VSP Google Docs are formally documented as vendor working files only, while client/commercial documents remain Document Suite controlled.
- No ambiguous document ownership remains.

## Sprint 7 - Invoice Minimum Path

Goal: create the minimum controlled invoice workflow needed for commercial billing.

Minimum acceptance:

- Active/accepted project can generate an invoice record.
- Invoice amount, currency, due date, status, and source quote are recorded.
- Invoice route/document follows Document Suite rules if client-facing.

## Sprint 8 - Full Live Lifecycle Verification

Goal: prove the full lifecycle in production.

Minimum acceptance:

- Lead -> Step 2 files -> Technical Review -> Qualification -> VSP -> Vendor Request -> Vendor Pricing -> Margin Review -> Quote Builder -> Quote PDF -> Send Quote -> Accept Quote -> Project -> Invoice works live.
- Sheets, Drive, Webhook Logs, Email Logs, and Workspace states match at each step.
- Remaining launch blockers are either fixed or explicitly accepted.
