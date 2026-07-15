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

## Sprint 3 - Send Approved Quote

Goal: add a Workspace-controlled action to send the generated approved quote to the client.

Minimum acceptance:

- Approved quote PDF can be sent from Workspace.
- Client email is sent and logged.
- Lead moves to `Quote Sent` / waiting acceptance state.
- `Documents` status is marked `Sent`.
- `Email Logs` and `Webhook Logs` record success/failure.

## Sprint 4 - Client Quote Acceptance

Goal: record client acceptance of a sent quote.

Minimum acceptance:

- Client or Workspace acceptance action exists.
- Lead moves to `Quote Accepted` / `Accepted`.
- Acceptance actor, timestamp, and source are audited.
- Duplicate acceptance is idempotent.

## Sprint 5 - Project Creation

Goal: expose project creation from accepted quote through Workspace and gateway.

Minimum acceptance:

- Accepted quote appears in a Project Creation queue.
- Workspace action calls existing backend project creation logic.
- Project row is created.
- Lead moves to `Project Active`.
- Drive/project folder and source document link are recorded.

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
