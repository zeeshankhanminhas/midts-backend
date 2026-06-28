# MIDTS Backend Deployment Checklist

This backend is deployed from GitHub to Google Apps Script. GitHub remains the source of truth; Apps Script is the deployment target.

This repo contains two deployable parts:

1. `src/` - Google Apps Script backend for enquiry intake, lifecycle routing, sheet control, email actions, document audit records, and quote/project workflow.
2. `renderer/` - Cloud Run PDF renderer used by Apps Script to render approved document URLs to PDF.

## 1. Create The Launch Google Sheet

Create a clean Google Sheet for MIDTS operations, for example:

```text
MIDTS Launch Operations
```

Copy the spreadsheet ID from the sheet URL. This value becomes `SPREADSHEET_ID`.

The backend creates and maintains the required tabs when `setupLaunchSheets()` runs.

Core operational tabs include:

```text
Leads
Technical Intake
Technical Reviews
Vendor Safe Packages
Vendor Pricing
Pipeline
Documents
Quote Responses
Projects
Delivery Records
Handover Records
Invoices
Webhook Logs
Email Logs
```

## 2. Create A New Apps Script Project

Create a new standalone Google Apps Script project.

Do not reuse the old Apps Script project.

The Apps Script project must use the V8 runtime.

## 3. Connect GitHub Code To Apps Script

Copy `.clasp.json.example` to `.clasp.json` outside GitHub and insert the Apps Script project ID:

```json
{
  "scriptId": "<apps-script-project-id>",
  "rootDir": "src"
}
```

Push the `src/` folder to Apps Script with clasp.

Do not commit `.clasp.json` if it contains a real script ID.

## 4. Set Required Apps Script Properties

In Apps Script project settings, add these required Script Properties:

```text
WEBSITE_WEBHOOK_TOKEN=<strong-shared-secret>
DECISION_TOKEN=<strong-internal-action-secret>
WEB_APP_URL=<current-apps-script-exec-url>
SPREADSHEET_ID=<launch-google-sheet-id>
DRIVE_ROOT_FOLDER_ID=<google-drive-root-folder-id>
PDF_RENDERER_URL=<cloud-run-renderer-url>/render/pdf
PDF_RENDERER_TOKEN=<strong-renderer-secret>
```

Recommended properties:

```text
INTAKE_EMAIL=<internal-midts-review-email>
TEST_EMAIL=<safe-test-recipient-email>
STEP2_FORM_URL=<full-step-2-form-url>
STEP2_FORM_BASE_URL=<step-2-form-base-url>
CAPABILITY_STATEMENT_URL=<frontend-capability-statement-url>
QUOTE_TEMPLATE_URL=<frontend-quote-template-url>
CLIENT_QUOTE_CURRENCY=GBP
QUOTE_VALIDITY_DAYS=30
QUOTE_VAT_TEXT=Subject to VAT where applicable
QUOTE_PAYMENT_TERMS=Payment terms are 14 days from invoice unless otherwise agreed.
DEFAULT_MARGIN_TYPE=percentage
DEFAULT_MARGIN_VALUE=25
DOCUMENT_PREPARED_BY=MIDTS Engineering
QUOTE_CLIENT_DELIVERY_ENABLED=false
```

Only set `QUOTE_CLIENT_DELIVERY_ENABLED=true` after quote PDF generation and client-specific delivery have been proven end to end.

## 5. Deploy The PDF Renderer

The renderer lives in `renderer/` and exposes:

```text
POST /render/pdf
GET /healthz
```

It requires:

```text
Authorization: Bearer <RENDERER_TOKEN>
```

Deploy it to Cloud Run from the `renderer/` directory with environment variables:

```text
RENDERER_TOKEN=<same-value-as-PDF_RENDERER_TOKEN>
ALLOWED_QUOTE_PREFIX=https://zeeshankhanminhas.github.io/NEW-MIDTS/documents/quote/
MAX_RENDER_MS=45000
```

After deployment, test:

```text
GET <cloud-run-url>/healthz
```

Then set Apps Script `PDF_RENDERER_URL` to:

```text
<cloud-run-url>/render/pdf
```

At the moment the renderer is configured for quote rendering. Extend `ALLOWED_QUOTE_PREFIX` or renderer validation before using it for other document routes such as Engineering Project Packs.

## 6. Initialize Backend Sheets

In Apps Script, run:

```text
setupLaunchSheets
```

Expected result:

- all required tabs exist
- headers are created or extended
- `Pipeline` refreshes from `Leads`
- `Documents` and `Quote Responses` tabs exist

Approve Google permissions when prompted.

## 7. Deploy Apps Script Web App

Deploy as Web App:

```text
Execute as: Me
Who has access: Anyone
```

Use the `/exec` URL for production website traffic.

Do not use `/dev` for the live website.

After deployment, update Apps Script property:

```text
WEB_APP_URL=<current-apps-script-exec-url>
```

## 8. Run Backend Rehearsal Tests

Run the current lifecycle in this order:

```text
testLifecycleIntakeWithSamplePost
```

Then set Script Property:

```text
TEST_LEAD_ID=<lead-id-returned-by-testLifecycleIntakeWithSamplePost>
```

Then run:

```text
testTechnicalReviewQualified
testDecisionQualified
testVendorSafePackageReady
testVendorPricingWithSamplePayload
testMarginApproval
testQuotePreparation
testQuoteDocumentLinkRefresh
testLeadDriveStructure
testQuoteApproval
testWorkflowActionUrls
testQuoteSendEmail
```

If client quote delivery is enabled and a real client-safe test recipient is configured, continue with:

```text
testQuoteAccessEmail
```

Expected controlled path:

```text
Step 1 -> Awaiting Step 2
Step 2 -> Pending Review
Technical Review -> Technical Review Complete
Decision Qualified -> Vendor Safe Review or Vendor Pricing
Vendor Safe Ready -> Vendor Pricing
Vendor Pricing -> Margin Review
Margin Approval -> Quote Preparation
Quote Preparation -> Quote Draft
Quote Approval -> Approved to Send with generated PDF
Quote Send -> Quote Sent
Client Accepts -> Quote Accepted
Project Created -> Project Active
```

## 9. Connect Frontend Website

Only after backend tests pass, set frontend hosting/build variables:

```text
NEXT_PUBLIC_MIDTS_WEBHOOK_URL=<apps-script-exec-url>
NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN=<same-value-as-WEBSITE_WEBHOOK_TOKEN>
```

Rebuild/redeploy the frontend after changing these values.

## 10. Project Pack Backend Readiness

The document suite now supports:

```text
/documents/sample-project-pack
/documents/project-pack/[projectId]
```

Backend work still required before live Project Pack generation is complete:

- add or confirm project-pack data fields in the backend record model
- expose a normalized Engineering Project Pack data contract
- provide asset URLs for CAD, drawing, sample output, CAM, delivery, and hero images
- decide whether live Project Pack rendering is static, server-rendered, or PDF-rendered through Cloud Run
- extend the PDF renderer allow-list if Project Pack PDFs are rendered from the frontend route

## 11. Launch Freeze Rule

Do not freeze the backend until these are true:

```text
One Submission ID -> One Lead
Step 1 does not trigger internal review
Step 2 triggers internal review
Technical Review is recorded before qualification decision
One Lead -> One Human Decision
Repeated decision clicks do not resend emails
Conflicting decision clicks are blocked
Vendor-safe gate blocks vendor pricing until ready
Vendor pricing cannot skip margin approval
Quote cannot be prepared before approved margin
Quote cannot be approved without a generated/audited document path
Every guard writes a visible log
Frontend success only appears after backend success
```
