# MIDTS Lifecycle Transaction Map

Purpose: make every human/business transaction in the MIDTS lifecycle explicit before migrating remaining Apps Script-facing actions to frontend pages plus the Cloud Run gateway.

Target architecture:

- Frontend pages render every human-facing form, review, action, and document template.
- Cloud Run gateway receives every submission.
- Apps Script remains the backend engine for sheet writes, email, Drive, document control, and workflow state changes.
- Apps Script `/exec` pages are allowed only as emergency fallback until migrated.

## Compliance Legend

| Status | Meaning |
|---|---|
| `Yes` | Human/user transaction goes through frontend or gateway; Apps Script is backend only. |
| `Partial` | Backend support exists, but link/form generation or docs still expose Apps Script or require fallback. |
| `No` | Transaction is currently Apps Script link/form/test/manual. |
| `N/A` | Backend-only side effect; no human submission expected. |

## Lifecycle Transactions

| # | Lifecycle action | Owner | Current URL / surface | Payload fields | Backend handler | Sheet writes | Email/template | Gateway-compliant? | Migration note |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Step 1 enquiry | Client | `NEW-MIDTS/#contact` | `formStage=step1`, `lead_id`, `full_name`, `work_email`, `company`, `project_type`, `brief_requirement`, `source`, `pageUrl` | `WebhookRouter.handlePost` -> `LeadService.createLead` | `Leads`, `Webhook Logs`, `Email Logs` | Client acknowledgement / Step 2 link | Yes | Keep as gateway route. |
| 2 | Step 2 technical intake | Client | `NEW-MIDTS/step-2?leadId=...` | `formStage=step2`, `leadId`, `submissionId`, `technicalRequirement`, `timelineUrgency`, `filesDrawingsReady`, `requirementComplexity`, `filesProvided`, `fileLinks`, `source`, `pageUrl` | `WebhookRouter.handlePost` -> `TechnicalIntakeService.completeStep2` | `Technical Intake`, `Leads`, `Webhook Logs`, `Email Logs` | Internal review notification | Yes | File upload is manual/Drive-link until secure upload exists. |
| 3 | Technical review | MIDTS reviewer | Apps Script test/manual only (`testTechnicalReviewQualified`) | `leadId`, `reviewer`, `reviewSummary`, `fileReview`, `risks`, `clarifications`, `recommendation` | `TechnicalReviewService.recordReview` | `Technical Reviews`, `Leads` | None dedicated; review is prerequisite for decision | No | First migration candidate: create frontend technical review page and gateway action. |
| 4 | Qualification decision | MIDTS reviewer | Apps Script `WEB_APP_URL?action=decision&leadId=...&decision=...&token=...` | `leadId`, `decision`, `token`, optional `reviewer` | `DecisionService.handleDecisionRequest` -> `DecisionService.applyDecision` | `Leads`, `Webhook Logs`, `Email Logs` | Decision outcome email; qualified workflow email | No | Should move behind frontend review/decision page after technical review is captured. |
| 5 | Needs more info decision | MIDTS reviewer | Same Apps Script decision URL | `leadId`, `decision=needs-more-info`, `token`, optional `reviewer` | `DecisionService.handleDecisionRequest` | `Leads`, `Webhook Logs`, `Email Logs` | Client more-info email | No | Same migration as decision action. |
| 6 | Nurture decision | MIDTS reviewer | Same Apps Script decision URL | `leadId`, `decision=nurture`, `token`, optional `reviewer` | `DecisionService.handleDecisionRequest` | `Leads`, `Webhook Logs`, `Email Logs` | Client nurture email | No | Same migration as decision action. |
| 7 | Not suitable decision | MIDTS reviewer | Same Apps Script decision URL | `leadId`, `decision=not-suitable`, `token`, optional `reviewer` | `DecisionService.handleDecisionRequest` | `Leads`, `Webhook Logs`, `Email Logs` | Client decline/update email | No | Same migration as decision action. |
| 8 | Vendor-safe package ready | MIDTS reviewer | Apps Script workflow action URL `action=vendorSafeReady` | `leadId`, `action`, `token`, optional `reviewer` | `WorkflowActionService.handleActionRequest` -> `VendorPricingService.markVendorSafePackageReady` -> `VendorSafePackageService.preparePackage` | `Vendor Safe Packages`, `Leads`, `Webhook Logs`, `Email Logs` | Vendor request setup email if useful | No | Move to frontend `/internal/vendor-safe` with confirmation that approved files were placed in Drive. |
| 9 | Vendor pricing request setup | MIDTS commercial | Apps Script form `action=vendorRequestSetup` | `leadId`, `token`, `vendorName`, `vendorEmail`, `packageLink`, `vendorSafeFilesConfirmed` | `VendorRequestService.handleRequestSetupSubmission` -> `createAndSendRequest_` | `Vendor Requests`, `Leads`, `Email Logs` | Vendor pricing request email | No | Move to frontend `/internal/vendor-request` and submit through gateway. |
| 10 | Vendor commercial response | Vendor | `NEW-MIDTS/vendor-pricing?requestId=...&token=...` after latest change | `formStage=vendorPricing`, `action=vendorPricing`, `requestId`, `token`, `vendorCost`, `vendorCurrency`, `leadTime`, `quoteValidUntil`, `vendorReference`, `exclusions`, `notes` | Gateway -> Apps Script `doPost(action=vendorPricing)` -> `VendorRequestService.handleVendorPricingSubmission` -> `VendorPricingService.recordVendorPricing` | `Vendor Requests`, `Vendor Pricing`, `Leads`, `Webhook Logs`, `Email Logs` | Internal margin approval/workflow action email | Partial | Gateway path exists; requires deployed Apps Script `VENDOR_PRICING_FORM_URL` and updated Cloud Run. Old Apps Script form remains fallback. |
| 11 | Margin approval | MIDTS commercial | Apps Script workflow action URL `action=approveMargin` | `leadId`, `action`, `token`, optional `reviewer` | `WorkflowActionService.handleActionRequest` -> `VendorPricingService.approveLatestMargin` | `Vendor Pricing`, `Leads`, `Webhook Logs`, `Email Logs` | Workflow email for quote preparation | No | Move to frontend `/internal/margin-approval` with visible vendor cost, margin, client price, and approval template. |
| 12 | Quote preparation | MIDTS commercial | Apps Script workflow action URL `action=prepareQuote` | `leadId`, `action`, `token`, optional `reviewer` | `WorkflowActionService.handleActionRequest` -> `QuoteService.prepareQuoteDraft` | `Leads`, `Documents`, `Webhook Logs`, `Email Logs` | Workflow email for quote approval | No | Move to frontend `/internal/quote-control` and link to quote document template. |
| 13 | Quote document link refresh | MIDTS control | Apps Script test/manual (`testQuoteDocumentLinkRefresh`) | `leadId` | `QuoteService.refreshQuoteDocumentLink` | `Leads`, `Documents` | None | No | Fold into quote-control page. |
| 14 | Quote approval | MIDTS approver | Apps Script workflow action URL `action=approveQuote` | `leadId`, `action`, `token`, optional `reviewer` | `WorkflowActionService.handleActionRequest` -> `QuoteService.approveQuoteDraft` | `Leads`, `Documents`, `Webhook Logs`, `Email Logs` | Quote-send approval email | No | Move to frontend quote-control approval page with rendered quote preview. |
| 15 | Send approved quote | MIDTS approver | Apps Script workflow action URL `action=sendQuote` | `leadId`, `action`, `token`, optional `reviewer` | `WorkflowActionService.handleActionRequest` -> `QuoteDeliveryService.sendQuoteToClient` | `Quote Responses`, `Leads`, `Email Logs`, `Webhook Logs` | Client quote email with accept/reject links | No | Move to frontend quote-control send confirmation. |
| 16 | Client quote view/get | Client | `NEW-MIDTS/quote-acceptance?quoteId=...&token=...` | `formStage=quote_acceptance`, `action=getQuote`, `quoteId`, `token` | Gateway -> Apps Script `doPost(action=getQuote/quoteResponse path via gateway legacy)` -> `QuoteDeliveryService.render/handle` equivalent | Read `Quote Responses`, `Leads` | None | Yes | Keep as gateway route; verify handler mapping remains current. |
| 17 | Client quote accept | Client | `NEW-MIDTS/quote-acceptance?quoteId=...&token=...` | `formStage=quote_acceptance`, `action=acceptQuote`, `quoteId`, `token`, optional `clientNotes` | Gateway -> `QuoteDeliveryService.handleClientResponse` -> `ProjectService.createProjectFromAcceptedQuote` | `Quote Responses`, `Projects`, `Leads`, `Email Logs`, `Webhook Logs` | Internal client response notification | Yes | Keep as gateway route. |
| 18 | Client quote reject | Client | `NEW-MIDTS/quote-acceptance?quoteId=...&token=...` | `formStage=quote_acceptance`, `action=rejectQuote`, `quoteId`, `token`, optional `clientNotes` | Gateway -> `QuoteDeliveryService.handleClientResponse` | `Quote Responses`, `Leads`, `Email Logs`, `Webhook Logs` | Internal client response notification | Yes | Keep as gateway route. |
| 19 | Project creation | Backend automation | Triggered after quote acceptance | `leadId`, `creator` | `ProjectService.createProjectFromAcceptedQuote` | `Projects`, `Leads` | None dedicated | N/A | Backend side effect; expose project-control view later. |
| 20 | Delivery record | MIDTS delivery | Apps Script test/manual only | `projectId`, `details`, `actor` | `DeliveryService.recordDelivery` | `Delivery Records`, `Leads` | None dedicated | No | Create frontend `/internal/delivery` transaction page and completion report template link. |
| 21 | Handover record | MIDTS delivery | Apps Script test/manual only | `projectId`, `details`, `actor` | `HandoverService.recordHandover` | `Handover Records`, `Leads` | None dedicated | No | Create frontend `/internal/handover` transaction page and handover pack template link. |
| 22 | Invoice record | MIDTS commercial | Apps Script test/manual only | `projectId`, `invoice input`, `actor` | `InvoiceService` | `Invoices`, `Leads` | None dedicated | No | Create frontend `/internal/invoice` transaction page and invoice template link. |

## Document / Template Coverage

| Template | Frontend route | Current lifecycle use | Gap |
|---|---|---|---|
| Requirement Sheet | `/documents/requirement-sheet` | Represents Step 1 + Step 2 intake | Not linked as transaction output after Step 2. |
| Technical Review | `/documents/technical-review` | Supports technical review decision | No frontend technical review transaction yet. |
| Capability Statement | `/documents/capability-statement` | Optional client-facing support document | Property exists; not tied to all decision paths. |
| Proposal | `/documents/proposal` | Pre-quote/support proposal | Not yet a controlled lifecycle output. |
| Statement of Work | `/documents/statement-of-work` | Delivery scope control | Not yet generated from accepted quote/project. |
| Quote | `/documents/quote` | Quote draft/approved quote template | Used by quote document link; needs quote-control page for approval/send. |
| Completion Report | `/documents/completion-report` | Delivery completion evidence | Delivery transaction not gateway-based yet. |
| Handover Pack | `/documents/handover-pack` | Final file release | Handover transaction not gateway-based yet. |
| Invoice | `/documents/invoice` | Billing record | Invoice transaction not gateway-based yet. |
| Email Templates | `/documents/email-templates` | Sendable email copy reference | Backend email strings are still inline in Apps Script, not template-driven. |

## Current Apps Script-Facing Surfaces To Remove

| Surface | Source | Replacement |
|---|---|---|
| `DecisionService.buildDecisionUrl` | Apps Script `WEB_APP_URL?action=decision...` | Frontend `/internal/review-decision?leadId=...&token=...` -> gateway. |
| `WorkflowActionService.buildActionUrl` | Apps Script `WEB_APP_URL?action=vendorSafeReady/approveMargin/prepareQuote/approveQuote/sendQuote...` | Frontend internal action pages -> gateway. |
| `VendorRequestService.renderRequestSetup` | Apps Script HTML form | Frontend `/internal/vendor-request` -> gateway. |
| `VendorRequestService.renderVendorPricingForm` | Apps Script HTML vendor form | Frontend `/vendor-pricing` -> gateway; keep fallback only. |
| `QuoteDeliveryService.renderClientResponse` | Apps Script HTML quote response fallback | Frontend `/quote-acceptance` -> gateway. |

## Migration Order

Migrate one action at a time in this order:

1. Technical review + decision spine.
   - Create frontend internal technical review page.
   - Submit `recordTechnicalReview` through gateway.
   - Replace Step 2 email decision buttons with a single `Complete Technical Review` link.
   - After review is recorded, show allowed decision choices.
2. Vendor-safe ready.
   - Create frontend vendor-safe confirmation page.
   - Include Drive folder link, file checklist, and confirmation.
   - Submit `vendorSafeReady` through gateway.
3. Vendor request setup.
   - Move MIDTS vendor name/email/package confirmation form from Apps Script to frontend.
   - Submit through gateway.
4. Margin approval.
   - Create frontend approval page with vendor cost, margin, calculated client price, revision.
   - Submit `approveMargin` through gateway.
5. Quote control.
   - Create frontend quote prepare/approve/send control page.
   - Link to quote document template and rendered PDF status.
6. Project delivery controls.
   - Add delivery, handover, and invoice pages with matching document templates.
7. Update documentation and remove stale direct-Apps-Script frontend env references.

## Required Gateway Action Contract

Every migrated action should follow this shape:

```text
formStage=<transaction-name>
action=<backend-action>
token=<scoped-action-token>
leadId/requestId/projectId/quoteId=<primary reference>
actor=<human/system actor where useful>
payload fields=<transaction-specific data>
source=<frontend route name>
pageUrl=<browser URL>
```

Minimum response contract:

```text
ok/success
status
message
leadId/requestId/projectId/quoteId
nextAction
lifecycleStatus
audit/log reference where available
```

## Definition Of Done For Each Migration

- No human-facing submission posts directly to Apps Script.
- Email link opens a frontend route, not `script.google.com`.
- Frontend posts to Cloud Run gateway.
- Gateway validates the transaction fields.
- Apps Script handler performs the existing sheet/email/Drive work.
- Success page/message appears only after backend success.
- Transaction is listed in this map as `Yes`.
- Related README/DEPLOYMENT/TEST_PLAN text is updated.
