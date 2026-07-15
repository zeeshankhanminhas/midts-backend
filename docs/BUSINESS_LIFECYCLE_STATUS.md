# MIDTS Business Lifecycle Status

Last reviewed: 2026-07-15
Branch reviewed: `sprint/partner-assessment-controlled-docs`
Repository role: backend gateway, Apps Script services, Sheets, Drive, document generation, and email transport.

## Architecture Check

The current architecture remains valid for the MIDTS commercial pipeline:

- Workspace owns business UI and operational decisions.
- The Cloud Run gateway remains the single frontend-to-backend entry point.
- Apps Script remains the backend/data layer for Sheets, Drive, document generation, and email transport.
- Google Sheets remain the operational audit store.
- Workspace routes pass backend/audit identifiers invisibly through route state, backend reads, and hidden payloads.
- Public marketing routes and public document exposure are not part of this sprint.

No parallel backend path or replacement architecture was introduced in this sprint.

## Completed Lifecycle Slices

| Stage | Status | Backend notes |
| --- | --- | --- |
| Website Lead | Complete | Lead capture writes `Leads`, logs webhook attempts, and sends acknowledgement email. |
| Step 2 Technical Intake | Complete | Technical intake writes `Technical Intake`, uploads client files to Drive, stores Drive URLs, updates lead lifecycle, and logs/email-notifies internally. |
| Technical Review / Partner Technical Assessment | Complete | `recordTechnicalReview` remains the contract. The service now requires partner assessment evidence, canonical feasibility status, reviewer identity, reviewed files/revisions, and assessment links. |
| Qualification Decision | Complete | DecisionService requires a complete partner assessment before routing qualification outcomes. Legacy Apps Script decision-link workflow remains retired for this slice. |
| Vendor Safe Package | Complete enough for current pipeline | Vendor-safe package generation remains the controlled package handoff before vendor pricing. It consumes qualified technical review evidence and approved client file context. |
| Vendor Request Setup | Complete | Vendor requests now require complete partner assessment evidence and, when applicable, the latest approved Vendor Safe Package link. Requests store Technical Review ID, source package ID, scope revision, and files/revisions priced. |
| Vendor Pricing Submission | Complete | Vendor pricing submission records pricing, updates the request, and moves the lead to Margin Review. |
| Margin Review | Implemented before this sprint | Existing service/routes support pending margin reviews, margin update, approval, and movement to Quote Preparation. Not changed in this sprint. |
| Quote Builder | Implemented before this sprint | Quote builder consumes approved margin/vendor pricing and creates controlled quote snapshots. Not changed in this sprint. |
| Quote Draft Review / Controlled Quote Document | Partially complete | This sprint fixed the quote read payload to be client-safe and prevents URL status override. Further end-to-end review/PDF/send verification remains required. |

## Not Yet Complete / Needs Verification

| Stage | Status | Remaining work |
| --- | --- | --- |
| Proposal Builder | Not complete | No completed Workspace-controlled proposal builder slice has been verified in this sprint. |
| Project Creation | Not complete | No completed project creation handoff has been verified in this sprint. |
| Quote PDF generation and release | Needs live verification | Backend document controls exist, but full live PDF generation, approval, send, and audit verification still need deployment/runtime testing. |
| Production Workspace authentication | Preview only | Existing Workspace auth remains preview-level and is not production security. |

## Conflict Check

Before this status file was added, the sprint branch compared to `main` as:

- Status: `ahead`
- Ahead by: 8 commits
- Behind by: 0 commits

That means the branch was a fast-forward merge candidate with no detected divergence from `main` at the time of review.

## Sprint Outcome

This sprint completes the Partner Technical Assessment bridge and controlled quote document hardening needed before merging the current sprint work:

- Partner assessment evidence is captured, validated, stored, and surfaced in Workspace reads.
- Qualification is blocked until partner evidence is complete.
- Vendor request setup is linked to the assessment and approved package evidence.
- Quote document reads no longer expose internal commercial objects and no longer accept URL status overrides.
