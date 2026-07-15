# MIDTS Business Lifecycle Status

Last reviewed: 2026-07-15
Branch reviewed: `sprint/7-invoice-minimum-path`
Repository role: backend gateway, Apps Script services, Sheets, Drive, document generation, and email transport.

## Architecture Check

The current architecture remains valid for the MIDTS commercial pipeline:

- Workspace owns business UI and operational decisions.
- The Cloud Run gateway remains the single frontend-to-backend entry point.
- Apps Script remains the backend/data layer for Sheets, Drive, document generation, and email transport.
- Google Sheets remain the operational audit store.
- Workspace routes pass backend/audit identifiers invisibly through route state, backend reads, and hidden payloads.
- Vendor Safe Package is documented as vendor working material, not a competing client document system.
- Public marketing routes and public document exposure are not part of this sprint.

No parallel backend path or replacement architecture was introduced.

## Completed Lifecycle Slices

| Stage | Status | Backend notes |
| --- | --- | --- |
| Website Lead | Complete | Lead capture writes `Leads`, logs webhook attempts, and sends acknowledgement email. |
| Step 2 Technical Intake | Complete | Technical intake writes `Technical Intake`, uploads client files to Drive, stores Drive URLs, updates lead lifecycle, and logs/email-notifies internally. |
| Technical Review / Partner Technical Assessment | Complete | `recordTechnicalReview` remains the contract. |
| Qualification Decision | Complete | DecisionService requires a complete partner assessment before routing qualification outcomes. |
| Vendor Safe Package | Complete | Vendor-safe package generation remains the controlled package handoff before vendor pricing and is documented as vendor working material only. |
| Vendor Request Setup | Complete | Vendor requests require complete partner assessment evidence and package evidence where applicable. |
| Vendor Pricing Submission | Complete | Vendor pricing submission records pricing, updates the request, and moves the lead to Margin Review. |
| Margin Review | Implemented | Existing service/routes support pending margin reviews, margin update, approval, and movement to Quote Preparation. |
| Quote Builder | Implemented | Quote builder consumes approved margin/vendor pricing and creates controlled quote snapshots. |
| Quote Draft Review / Controlled Quote Document | Sprint 2 hardened | Quote approval signs the protected Workspace quote document URL for PDF rendering. |
| Send Approved Quote | Sprint 3 implemented | `MidtsQuoteSendService` lists generated approved PDFs and sends the selected quote. |
| Client Quote Acceptance | Sprint 4 implemented | `MidtsQuoteAcceptanceService` lists sent quotes, records acceptance, and updates the lead to project-creation readiness. |
| Project Creation | Sprint 5 implemented | `MidtsProjectService` lists accepted quotes without projects and creates project rows. |
| Document Suite / VSP alignment | Sprint 6 implemented | `docs/DOCUMENT_OWNERSHIP.md` defines VSP as vendor working files and client-commercial documents as Document Suite concerns. |
| Invoice minimum path | Sprint 7 implemented | `MidtsInvoiceService` lists active projects ready for invoice records and creates draft invoice rows from approved pricing through the existing gateway pattern. |
| Workspace Authentication | Sprint 1 frontend implementation | Production Workspace auth is implemented in the frontend branch. |

## Not Yet Complete / Needs Verification

| Stage | Status | Remaining work |
| --- | --- | --- |
| Quote PDF generation and release | Sprint 2 pending live verification | Apps Script needs deployment and live quote approval verification against Drive, `Documents`, `Leads`, and `Webhook Logs`. |
| Send approved quote | Sprint 3 pending live verification | Apps Script needs deployment and live send verification against client email receipt, `Documents`, `Leads`, `Email Logs`, and `Webhook Logs`. |
| Client quote acceptance | Sprint 4 pending live verification | Apps Script needs deployment and live acceptance verification against `Quote Acceptances`, `Leads`, and `Webhook Logs`. |
| Project Creation | Sprint 5 pending live verification | Apps Script needs deployment and live project creation verification against `Projects`, `Leads`, Drive folder, source quote document ID, and `Webhook Logs`. |
| Invoice minimum path | Sprint 7 pending live verification | Apps Script needs deployment and live invoice creation verification against `Invoices`, `Leads`, and `Webhook Logs`. |
| Proposal Builder | Not complete | No completed Workspace-controlled proposal builder slice has been verified. |

## Commercial Launch Sprint Plan

See `docs/COMMERCIAL_LAUNCH_SPRINTS.md` for the eight-sprint launch plan and Sprint 7 deployment verification.

## Conflict Check

Sprint 7 preserves the existing gateway/Apps Script architecture. It adds only the active-project invoice read/action path and reuses existing project, lead, pricing, invoice, sheet, and webhook logging services.
