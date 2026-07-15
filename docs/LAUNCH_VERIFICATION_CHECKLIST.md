# MIDTS Full Lifecycle Launch Verification

Last updated: 2026-07-15

This checklist verifies the live commercial lifecycle after frontend deployment and Apps Script/gateway deployment.

## Required Deployments

- Frontend `main` deployed on Vercel.
- Backend Apps Script source pushed from `main`.
- Apps Script Web App deployed as a new version.
- Cloud Run gateway redeployed with the current Apps Script Web App URL and token configuration.
- Vercel `NEXT_PUBLIC_MIDTS_GATEWAY_URL` points to Cloud Run, not Apps Script directly.
- Quote PDF renderer variables are configured: `QUOTE_RENDER_SECRET`, `PDF_RENDERER_URL`, `PDF_RENDERER_TOKEN`.

## Test Record

Use one real test lead and record its generated IDs in the private deployment notes. Workspace users must not type these identifiers into workflow forms.

## Lifecycle Checks

| Step | Action | Expected Workspace state | Expected backend evidence |
| --- | --- | --- | --- |
| 1 | Submit website lead | Lead created | `Leads` row, acknowledgement email, `Webhook Logs` success |
| 2 | Submit Technical Intake with files | Technical Review pending | `Technical Intake` row, Drive file links, lead Step 2 complete, internal notification |
| 3 | Open Technical Review | Uploaded files and intake context visible | Workspace read returns live intake/file links |
| 4 | Submit Technical Review | Qualification pending | `Technical Reviews` row, lead review complete, `Webhook Logs` success |
| 5 | Record Qualification Decision | Vendor Safe Package or next route selected | Lead qualification/lifecycle updated |
| 6 | Prepare Vendor Safe Package | Vendor Request ready | `Vendor Safe Packages` row, Drive VSP folder/docs, uploaded client files copied where applicable |
| 7 | Send Vendor Request | Waiting vendor pricing | Vendor request email sent, lead vendor pricing state updated |
| 8 | Submit Vendor Pricing | Margin Review pending | `Vendor Pricing` row, lead margin review state updated |
| 9 | Approve Margin | Quote Builder ready | Vendor pricing approved, lead quote preparation state updated |
| 10 | Prepare Quote Draft | Quote Draft Review ready | `Documents` quote snapshot created |
| 11 | Approve Quote Draft | Send Approved Quote ready | Quote PDF generated in Drive, `Documents` PDF fields updated |
| 12 | Send Approved Quote | Quote Acceptance ready | Client email sent with PDF, `Documents` marked Sent, `Email Logs` success |
| 13 | Record Quote Acceptance | Project Creation ready | `Quote Acceptances` row, lead quote accepted state updated |
| 14 | Create Project | Project active | `Projects` row, Drive folder/source document link, lead Project Active |
| 15 | Create Invoice Record | Invoice draft created | `Invoices` row, lead next action `Issue invoice`, `Webhook Logs` success |

## Document Ownership Checks

- Quote PDF is generated through protected Workspace Document Suite rendering.
- No public `/documents/*` route is used or added.
- Vendor Safe Package remains vendor working material in Drive/Google Docs.
- Invoice Sprint 7 creates a billing record only; future client-facing invoice rendering must use protected Workspace Document Suite rules.

## Pass Criteria

- Every queue loads from live backend data without seeded/demo records.
- Every selected Workspace page uses route/backend context for identifiers.
- No editable system identifier fields appear in Workspace forms.
- Each backend action records success/failure in `Webhook Logs`.
- Sheet state, Drive artifacts, emails, and Workspace queue transitions agree at every step.

## Current Status

Code for Sprints 1-7 is implemented. Full live lifecycle verification remains pending until Apps Script and Cloud Run gateway are deployed from `main` and the checklist above is executed with a real test lead.
