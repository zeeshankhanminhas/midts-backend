# MIDTS Business Lifecycle Status

Last reviewed: 2026-07-15
Branch reviewed: `sprint/2-quote-pdf-live-hardening`
Repository role: backend gateway, Apps Script services, Sheets, Drive, document generation, and email transport.

## Architecture Check

The current architecture remains valid for the MIDTS commercial pipeline:

- Workspace owns business UI and operational decisions.
- The Cloud Run gateway remains the single frontend-to-backend entry point.
- Apps Script remains the backend/data layer for Sheets, Drive, document generation, and email transport.
- Google Sheets remain the operational audit store.
- Workspace routes pass backend/audit identifiers invisibly through route state, backend reads, and hidden payloads.
- Public marketing routes and public document exposure are not part of this sprint.

No parallel backend path or replacement architecture was introduced.

## Completed Lifecycle Slices

| Stage | Status | Backend notes |
| --- | --- | --- |
| Website Lead | Complete | Lead capture writes `Leads`, logs webhook attempts, and sends acknowledgement email. |
| Step 2 Technical Intake | Complete | Technical intake writes `Technical Intake`, uploads client files to Drive, stores Drive URLs, updates lead lifecycle, and logs/email-notifies internally. |
| Technical Review / Partner Technical Assessment | Complete | `recordTechnicalReview` remains the contract. The service requires partner assessment evidence, canonical feasibility status, reviewer identity, reviewed files/revisions, and assessment links. |
| Qualification Decision | Complete | DecisionService requires a complete partner assessment before routing qualification outcomes. Legacy Apps Script decision-link workflow remains retired for this slice. |
| Vendor Safe Package | Complete enough for current pipeline | Vendor-safe package generation remains the controlled package handoff before vendor pricing. Document-engine alignment is still tracked separately. |
| Vendor Request Setup | Complete | Vendor requests require complete partner assessment evidence and, when applicable, the latest approved Vendor Safe Package link. Requests store Technical Review ID, source package ID, scope revision, and files/revisions priced. |
| Vendor Pricing Submission | Complete | Vendor pricing submission records pricing, updates the request, and moves the lead to Margin Review. |
| Margin Review | Implemented | Existing service/routes support pending margin reviews, margin update, approval, and movement to Quote Preparation. |
| Quote Builder | Implemented | Quote builder consumes approved margin/vendor pricing and creates controlled quote snapshots. |
| Quote Draft Review / Controlled Quote Document | Sprint 2 hardened | Quote approval signs the protected Workspace quote document URL for PDF rendering and reports renderer/configuration failures clearly. |
| Workspace Authentication | Sprint 1 frontend implementation | Production Workspace auth is implemented in the frontend branch. No Apps Script/backend service change is required for Sprint 1. |

## Not Yet Complete / Needs Verification

| Stage | Status | Remaining work |
| --- | --- | --- |
| Quote PDF generation and release | Sprint 2 pending live verification | Apps Script needs deployment with `QUOTE_RENDER_SECRET`, `PDF_RENDERER_URL`, and `PDF_RENDERER_TOKEN`. Then quote approval must be verified against Drive, `Documents`, `Leads`, and `Webhook Logs`. |
| Send approved quote | Not complete | No completed Workspace-controlled send quote action has been verified. |
| Client quote acceptance | Not complete | No client or internal accepted-quote workflow has been verified. |
| Project Creation | Not complete | Backend support exists, but no completed Workspace/gateway handoff has been verified. |
| Proposal Builder | Not complete | No completed Workspace-controlled proposal builder slice has been verified. |
| Invoice minimum path | Not complete | Invoice schema exists, but no completed billing workflow has been verified. |
| Document Suite / VSP alignment | Not complete | Quote uses the Document Suite path. Vendor Safe Package still generates Google Docs working files unless formally accepted as an exception. |

## Commercial Launch Sprint Plan

See `docs/COMMERCIAL_LAUNCH_SPRINTS.md` for the eight-sprint launch plan and Sprint 2 deployment variables.

## Conflict Check

Sprint 2 preserves the existing gateway/Apps Script architecture. It changes only approved quote PDF rendering access and error reporting; it does not alter public routes, record contracts, or earlier lifecycle slices.
