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

Implementation notes:

- `docs/DOCUMENT_OWNERSHIP.md` defines the Document Suite boundary.
- Vendor Safe Package remains vendor working material in Drive/Google Docs.
- Quote, proposal, and invoice client/commercial documents remain owned by the protected Workspace Document Suite.
- No public document route, new app, or replacement document engine was introduced.

## Sprint 7 - Invoice Minimum Path

Goal: create the minimum controlled invoice workflow needed for commercial billing.

Minimum acceptance:

- Active/accepted project can generate an invoice record.
- Invoice amount, currency, due date, status, and source quote are recorded.
- Invoice route/document follows Document Suite rules if client-facing.

Status: implemented on `sprint/7-invoice-minimum-path`, pending Apps Script deployment and live verification.

Implementation notes:

- `MidtsInvoiceService.listPendingInvoices()` exposes open active projects that have approved pricing and no existing invoice.
- `MidtsInvoiceService.createInvoiceFromProject()` creates a draft invoice record from the selected project using approved client quote amount/currency.
- The router accepts `action=listPendingInvoices`, `formStage=workspaceRead` for queue reads.
- The router accepts `action=createInvoiceFromProject`, `formStage=invoiceCreation` for the selected Workspace action.
- Successful creation writes `Invoices`, updates lead next action to `Issue invoice`, and records `invoice_created` in `Webhook Logs`.
- The previous `issueInvoice()` function remains available for the later delivery/handover-issued invoice path.

Deployment verification:

- Deploy Apps Script after Sprint 7 backend changes.
- Confirm `listPendingInvoices` returns active projects with approved pricing and no invoice.
- Create one invoice from Workspace.
- Confirm `Invoices`, `Leads`, and `Webhook Logs` update consistently.

## Sprint 8 - Full Live Lifecycle Verification

Goal: prove the full lifecycle in production.

Minimum acceptance:

- Lead -> Step 2 files -> Technical Review -> Qualification -> VSP -> Vendor Request -> Vendor Pricing -> Margin Review -> Quote Builder -> Quote PDF -> Send Quote -> Accept Quote -> Project -> Invoice works live.
- Sheets, Drive, Webhook Logs, Email Logs, and Workspace states match at each step.
- Remaining launch blockers are either fixed or explicitly accepted.
