# MIDTS Backend

Clean backend for MIDTS website enquiry capture and launch automation.

## Launch Scope

The first launchable version does one controlled commercial lifecycle well:

1. Receive website enquiry submissions from the MIDTS frontend.
2. Validate the shared webhook token.
3. Write the Step 1 lead row into the Google Sheet.
4. Record every attempt in a webhook log sheet.
5. Send a client acknowledgement email with the Step 2 technical intake link.
6. Receive Step 2 technical intake submissions.
7. Write Step 2 detail into the Technical Intake sheet.
8. Send an internal review email with decision links only after Step 2 is complete.
9. Route human-approved decisions without manual sheet editing.
10. Move qualified leads into vendor-safe review or vendor pricing before any quote is prepared.
11. Record vendor pricing and margin calculation in the Vendor Pricing tab.
12. Approve the latest pricing revision before quote preparation.
13. Prepare a quote draft state using the private Workspace Quote document route.
14. Serve saved quote snapshots to the protected Workspace quote document route.
15. Approve the quote draft before sending.
16. Record email attempts in an email log sheet.
17. Return a clear success or failure response.

No dashboard, document generation, frontend rendering, or Apps Script-only website logic belongs in this repo.

## Source Of Truth

GitHub is the source of truth for backend code.

Apps Script is the deployment target only.

## Required Runtime

- Google Apps Script V8 runtime
- Google Sheet for operational storage
- Script Properties for secrets/config
- MailApp permission for acknowledgement/internal email

## Required Google Sheet Tabs

| Tab | Purpose |
| --- | --- |
| `Leads` | One-row lifecycle summary for each enquiry. |
| `Technical Intake` | Step 2 technical/commercial qualification detail. |
| `Vendor Pricing` | Vendor cost, margin, quote pricing, and revision tracking. |
| `Documents` | Quote snapshots, PDF audit IDs, and client-ready document state. |
| `Webhook Logs` | Intake, decision, duplicate, and routing audit trail. |
| `Email Logs` | Client/internal/outcome email audit trail. |

Run `setupLaunchSheets` after pushing Apps Script changes to create any missing tabs and headers.

## Required Script Properties

| Key | Purpose |
| --- | --- |
| `WEBSITE_WEBHOOK_TOKEN` | Shared secret expected from website form payloads. |
| `DECISION_TOKEN` | Shared secret used in internal review decision links. |
| `WEB_APP_URL` | Current Apps Script Web App `/exec` URL used to build decision links. |
| `STEP2_FORM_URL` | Optional. Full Step 2 form URL sent to the client. |
| `STEP2_FORM_BASE_URL` | Optional fallback. Base Step 2 form URL; `leadId` and `submissionId` are appended. |
| `SPREADSHEET_ID` | Optional. If omitted, the script uses the active spreadsheet. |
| `INTAKE_EMAIL` | Optional. Internal notification address. Defaults to `intake@midts.com`. |
| `TEST_EMAIL` | Optional. Recipient for Apps Script test emails. |
| `DEFAULT_MARGIN_TYPE` | Optional. `percentage` or `fixed`. Defaults to `percentage`. |
| `DEFAULT_MARGIN_VALUE` | Optional. Default margin value. Defaults to `25`. |
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

Internal review emails use `WEB_APP_URL` and `DECISION_TOKEN` to generate decision links for:

```text
Qualified
Needs More Info
Nurture
Not Suitable
```

## Commercial Gate

Qualified does not mean quote immediately.

The current controlled order is:

```text
Step 1 Lead
-> Step 2 Technical Intake
-> Human Decision
-> Vendor Safe Package if required
-> Vendor Pricing
-> Margin Approval
-> Quote Preparation
-> Quote Draft Review
-> Quote Approved to Send
```

If Step 2 marks a vendor-safe package as required, a Qualified decision routes the lead to `Vendor Safe Review` first. Otherwise it routes the lead to `Vendor Pricing`.

Vendor pricing, margin approval, quote preparation, and quote approval are internal workflow services, not public website webhook routes. The public website token must not become a commercial control key.

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
testVendorPricingWithSamplePayload
testMarginApproval
testQuotePreparation
testQuoteApproval
```

Expected result:

```text
Step 1 -> Awaiting Step 2
Step 2 -> Pending Review and internal review email sent
Qualified -> Vendor Safe Review if NDA/vendor-safe is required
Vendor Safe Ready -> Vendor Pricing
Vendor Pricing -> Margin Review Required
Margin Approval -> Quote Preparation
Quote Preparation -> Quote Draft
Quote Approval -> Approved to Send
```
