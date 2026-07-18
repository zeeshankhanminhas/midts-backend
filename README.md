# MIDTS Backend

Clean backend for MIDTS website enquiry capture and Workspace-controlled commercial automation.

## Launch Scope

The launchable version supports one controlled commercial lifecycle:

1. Receive website enquiry submissions from the MIDTS frontend.
2. Validate the shared webhook token.
3. Write the Step 1 lead row into the Google Sheet.
4. Record every attempt in the webhook log sheet.
5. Send a client acknowledgement email with the Step 2 technical intake link.
6. Receive Step 2 technical intake submissions.
7. Upload Step 2 files to Drive and write the Drive file links into the Technical Intake sheet.
8. Expose Step-2-complete leads to the protected Workspace Qualification queue.
9. Record Workspace-controlled Qualification Decisions.
10. Route Qualified leads to Vendor Safe Review when a vendor-safe package is required.
11. Generate the Vendor Safe Package folder, controlled package documents, package PDFs, and copied client files in Drive.
12. Expose approved packages to Workspace Vendor Request Setup.
13. Send the partner assessment request with the approved VSP link.
14. Block vendor pricing until a feasible, pricing-ready Partner Technical Assessment is received.
15. Generate the Partner Technical Assessment Report PDF and store its link in Technical Reviews.
16. Record vendor pricing and margin calculation in the Vendor Pricing tab.
17. Approve the latest pricing revision before quote preparation.
18. Prepare a quote draft state using the private Workspace Quote document route.
19. Serve saved quote snapshots to the protected Workspace quote document route.
20. Approve the quote draft before sending.
21. Record email attempts in the email log sheet.
22. Return clear success or failure responses through the Cloud Run gateway.

Workspace owns business UI and lifecycle control. Apps Script remains the backend/data layer for Sheets, Drive folders, generated documents/PDFs, and email transport.

## Source Of Truth

GitHub is the source of truth for backend code.

Apps Script is the deployment target only.

## Required Runtime

- Google Apps Script V8 runtime
- Google Sheet for operational storage
- Google Drive root folder for lead/package/document storage
- Script Properties for secrets/config
- MailApp permission for acknowledgement/internal/partner email
- DocumentApp and DriveApp permissions for controlled document and PDF generation

## Required Google Sheet Tabs

| Tab | Purpose |
| --- | --- |
| `Leads` | One-row lifecycle summary for each enquiry. |
| `Technical Intake` | Step 2 technical/commercial qualification detail and uploaded Drive file links. |
| `Technical Reviews` | Partner Technical Assessment evidence and generated assessment report links. |
| `Vendor Safe Packages` | VSP folder URL, manifest, generated document/PDF audit data, and package status. |
| `Vendor Requests` | Partner request token/status, assessment state, pricing readiness, and vendor submission bridge. |
| `Vendor Pricing` | Vendor cost, margin, quote pricing, and revision tracking. |
| `Documents` | Quote snapshots, PDF audit IDs, and client-ready document state. |
| `Webhook Logs` | Intake, decision, duplicate, routing, and backend action audit trail. |
| `Email Logs` | Client/internal/partner email audit trail. |

Run `setupLaunchSheets` after pushing Apps Script changes to create any missing tabs and headers.

## Required Script Properties

| Key | Purpose |
| --- | --- |
| `WEBSITE_WEBHOOK_TOKEN` | Shared secret expected from website form payloads. |
| `DECISION_TOKEN` | Shared secret used for internal Apps Script action links. |
| `WEB_APP_URL` | Current Apps Script Web App `/exec` URL used to build Step 2, partner assessment, and pricing links. |
| `STEP2_FORM_URL` | Optional. Full Step 2 form URL sent to the client. |
| `STEP2_FORM_BASE_URL` | Optional fallback. Base Step 2 form URL; `leadId` and `submissionId` are appended. |
| `SPREADSHEET_ID` | Optional. If omitted, the script uses the active spreadsheet. |
| `DRIVE_ROOT_FOLDER_ID` | Required for file upload, VSP folder creation, package documents, PDFs, partner assessment reports, and quotes. |
| `INTAKE_EMAIL` | Optional. Internal notification address. Defaults to `intake@midts.com`. |
| `TEST_EMAIL` | Optional. Recipient for Apps Script test emails. |
| `DEFAULT_MARGIN_TYPE` | Optional. `percentage` or `fixed`. Defaults to `percentage`. |
| `DEFAULT_MARGIN_VALUE` | Optional. Default margin value. Defaults to `30`. |
| `WORKSPACE_BASE_URL` | Recommended. Absolute production Workspace origin used to build protected document links, for example `https://new-midts.vercel.app`. |
| `FRONTEND_BASE_URL` | Optional fallback. Absolute frontend origin used when `WORKSPACE_BASE_URL` is not set. |
| `CAPABILITY_STATEMENT_URL` | Optional. Controlled capability statement URL. Do not point this at public `/documents/*` template routes. |
| `QUOTE_TEMPLATE_URL` | Optional override for the private Workspace quote route. If omitted, backend uses `WORKSPACE_BASE_URL + /workspace/documents/quote`, then `FRONTEND_BASE_URL + /workspace/documents/quote`; public `/documents/quote` values are ignored. |

At least one of `STEP2_FORM_URL` or `STEP2_FORM_BASE_URL` should exist before real client launch. If both are missing, the acknowledgement email asks the client to reply for help instead of giving a broken link.

## Public Endpoint

The deployed Apps Script Web App `/exec` URL is the backend target used by the Cloud Run gateway.

Frontend hosting must use the Cloud Run gateway URL, not Apps Script directly:

```text
NEXT_PUBLIC_MIDTS_GATEWAY_URL=<cloud-run-gateway-url>/webhook
```

## Commercial Gate

The current controlled order is:

```text
Step 1 Lead
-> Step 2 Technical Intake
-> Qualification Decision
-> Vendor Safe Package
-> Vendor Request Setup
-> Partner Technical Assessment
-> Vendor Pricing
-> Margin Approval
-> Quote Preparation
-> Quote Draft Review
-> Quote Approved to Send
-> Quote Acceptance
-> Project Creation
-> Invoice Creation
```

A Qualified commercial decision does not mean quote immediately. It routes the lead into the next controlled Workspace queue. If Step 2 marks a vendor-safe package as required, VSP generation must happen before any partner assessment request is sent. Vendor pricing remains blocked until the partner assessment outcome is `Feasible` or `Feasible with Assumptions` and pricing readiness is recorded.

Vendor pricing, margin approval, quote preparation, and quote approval are internal workflow services, not public website webhook routes. The public website token must not become a commercial control key.

## Folder And PDF Sequence

Drive folder creation follows the lifecycle:

```text
Lead_<leadId>
-> Client Intake Files
-> Vendor Safe
   -> VSP-<timestamp>
      -> generated package documents
      -> generated package PDFs
      -> 06 Client Files
      -> 07 MIDTS Files
-> Partner Assessments
   -> generated Partner Technical Assessment Report
   -> generated Partner Technical Assessment Report PDF
-> Quotes
```

The VSP package is approved only when all seven package documents and PDFs are generated and any Step 2 client files have been copied successfully into the package.

## Workspace Quote Documents

Quote Builder creates a row in the `Documents` sheet with `Document Type = Quote Snapshot`, stores the snapshot ID, and writes a protected link to the lead:

```text
/workspace/documents/quote?leadId=<leadId>&quoteSnapshotId=<documentId>&quoteReference=<quoteReference>&status=draft
```

The Workspace route reads saved quote data through the gateway action:

```text
action=getQuoteDocument
formStage=workspaceRead
```

The read accepts `quoteSnapshotId` plus `leadId`. Existing links that only have `leadId` and `quoteReference` are repaired at read time by loading the latest matching quote snapshot, so rows should not be manually edited.

## Apps Script Test Order

After `git pull` and `clasp push --force`, run:

```text
setupLaunchSheets
```

For a clean Step 1 and Step 2 rehearsal:

```text
testLifecycleIntakeWithSamplePost
```

Then set Script Property `TEST_LEAD_ID` to the new lead ID returned by that test and run:

```text
testDecisionQualified
testVendorSafePackageReady
testVendorRequestSetup
testPartnerAssessmentSubmission
testVendorPricingWithSamplePayload
testMarginApproval
testQuotePreparation
testQuoteApproval
```

Expected result:

```text
Step 1 -> Awaiting Step 2
Step 2 -> Qualification Decision
Qualified -> Vendor Safe Review if vendor-safe is required
Vendor Safe Package -> Vendor Request Setup / Contact Vendor
Vendor Request Setup -> Partner Assessment Requested
Partner Assessment Feasible + Pricing Ready -> Vendor Pricing
Vendor Pricing -> Margin Review Required
Margin Approval -> Quote Preparation
Quote Preparation -> Quote Draft
Quote Approval -> Approved to Send
```