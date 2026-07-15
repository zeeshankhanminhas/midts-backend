# MIDTS Commercial Launch Sprints

Last updated: 2026-07-15

The commercial launch path is split into eight focused sprints. Each sprint must keep the existing architecture: Workspace controls business UI, the gateway remains the integration boundary, Apps Script remains the backend/data/document transport layer, and public marketing routes stay unchanged.

## Sprint 1 - Production Workspace Auth

Goal: replace preview Workspace access with server-side session protection.

Status: frontend implementation is on `sprint/1-production-workspace-auth` in `zeeshankhanminhas/NEW-MIDTS`. No Apps Script/backend service change is required for this sprint.

## Sprint 2 - Quote PDF Live Hardening

Goal: verify and harden approved quote PDF generation through the Workspace Document Suite render path.

Status: implemented on `sprint/2-quote-pdf-live-hardening`, pending Apps Script deployment and live verification.

Required Apps Script properties:

- `PDF_RENDERER_URL`
- `PDF_RENDERER_TOKEN`
- `QUOTE_RENDER_SECRET` matching the frontend Vercel `QUOTE_RENDER_SECRET`

## Sprint 3 - Send Approved Quote

Goal: add a Workspace-controlled action to send the generated approved quote to the client.

Status: implemented on `sprint/3-send-approved-quote`, pending Apps Script deployment and live verification.

## Sprint 4 - Client Quote Acceptance

Goal: record client acceptance of a sent quote.

Status: implemented on `sprint/4-client-quote-acceptance`, pending Apps Script deployment and live verification.

## Sprint 5 - Project Creation

Goal: expose project creation from accepted quote through Workspace and gateway.

Status: implemented on `sprint/5-project-creation`, pending Apps Script deployment and live verification.

## Sprint 6 - Document Suite / VSP Alignment

Goal: resolve the Vendor Safe Package document-engine mismatch.

Status: implemented on `sprint/6-document-suite-vsp-alignment`.

## Sprint 7 - Invoice Minimum Path

Goal: create the minimum controlled invoice workflow needed for commercial billing.

Status: implemented on `sprint/7-invoice-minimum-path`, pending Apps Script deployment and live verification.

Implementation notes:

- `MidtsInvoiceService.listPendingInvoices()` exposes open active projects that have approved pricing and no existing invoice.
- `MidtsInvoiceService.createInvoiceFromProject()` creates a draft invoice record from the selected project using approved client quote amount/currency.
- The router accepts `action=listPendingInvoices`, `formStage=workspaceRead` for queue reads.
- The router accepts `action=createInvoiceFromProject`, `formStage=invoiceCreation` for the selected Workspace action.
- Successful creation writes `Invoices`, updates lead next action to `Issue invoice`, and records `invoice_created` in `Webhook Logs`.

## Sprint 8 - Full Live Lifecycle Verification

Goal: prove the full lifecycle in production.

Minimum acceptance:

- Lead -> Step 2 files -> Technical Review -> Qualification -> VSP -> Vendor Request -> Vendor Pricing -> Margin Review -> Quote Builder -> Quote PDF -> Send Quote -> Accept Quote -> Project -> Invoice works live.
- Sheets, Drive, Webhook Logs, Email Logs, and Workspace states match at each step.
- Remaining launch blockers are either fixed or explicitly accepted.

Status: verification checklist implemented on `sprint/8-full-live-lifecycle-verification`; live production run pending Apps Script and Cloud Run gateway deployment from `main`.

Implementation notes:

- `docs/LAUNCH_VERIFICATION_CHECKLIST.md` defines the production test sequence and pass criteria.
- The checklist covers Workspace queues, Sheets, Drive, email, Webhook Logs, and Document Suite ownership.
- Sprint 8 does not add a new architecture or public document exposure.

Deployment verification:

- Push/deploy backend Apps Script from `main`.
- Redeploy Cloud Run gateway with current Apps Script Web App URL and token configuration.
- Confirm Vercel `NEXT_PUBLIC_MIDTS_GATEWAY_URL` points to Cloud Run.
- Execute the full launch checklist with one real test lead.
