# Margin Review Workspace Slice

Margin Review follows the same Workspace -> Cloud Run gateway -> Apps Script -> Sheets lifecycle used by Technical Review, Qualification, Vendor Safe Package, and Vendor Request Setup.

## Request Lifecycle

```text
Workspace Margin Review queue
-> Cloud Run gateway /webhook
-> Apps Script Web App
-> MidtsWebhookRouter
-> MidtsMarginReviewService / MidtsVendorPricingService
-> Leads + Vendor Pricing + Webhook Logs
-> Workspace response
```

Workspace users do not enter system identifiers. The selected lead is loaded from the queue and carried through hidden payload fields.

## Workspace Read

The queue calls:

```text
action=listPendingMarginReviews
formStage=workspaceRead
```

The backend returns leads where:

- `Lifecycle Status` is `Margin Review`
- `Quote Status` is `Margin Review Required`
- `Vendor Pricing Status` is `Pricing Received`
- latest Vendor Pricing row is `Margin Review Required`
- latest Vendor Pricing row is not approved

The response includes vendor, vendor cost, margin, MIDTS profit, client quote, quote reference, pricing status, lead context, and notes.

## Actions

The selected review page sends:

```text
formStage=marginReview
action=approveMargin | rejectMargin | returnMarginToVendor
leadId=<selected workspace lead>
reviewer=<workspace user>
internalNotes=<optional audit notes>
```

`approveMargin` preserves the existing backend contract by delegating to `MidtsVendorPricingService.approveLatestMargin`. Approval updates:

- Vendor Pricing: `Pricing Status=Margin Approved`, `Pricing Approved=Yes`, approval audit fields
- Leads: `Lifecycle Status=Quote Preparation`, `Next Action=Prepare quote`, `Quote Status=Ready for Quote Draft`, `Vendor Pricing Status=Margin Approved`

`rejectMargin` and `returnMarginToVendor` update only existing Lead and Vendor Pricing fields and record Webhook Logs. No new sheet schema is required.

## Quote Builder Handoff

Quote Builder reads:

```text
action=listPendingQuoteBuilders
formStage=workspaceRead
```

The queue returns approved-margin leads where:

- `Lifecycle Status` is `Quote Preparation`
- `Quote Status` is `Ready for Quote Draft`
- `Vendor Pricing Status` is `Margin Approved`
- latest Vendor Pricing row is approved

This confirms the Margin Review approval has handed the lead to the next Workspace stage without manual data entry.

## Deployment Notes

Backend deployment requires both Apps Script and Cloud Run gateway updates:

```text
git pull --ff-only origin main
clasp push
clasp version "Margin Review workspace slice"
clasp deploy --deploymentId <WEB_APP_DEPLOYMENT_ID> --versionNumber <VERSION_NUMBER>
```

Then redeploy the Cloud Run gateway from the backend repo source so `listPendingMarginReviews`, `approveMargin`, `rejectMargin`, `returnMarginToVendor`, and `listPendingQuoteBuilders` pass gateway validation.

Frontend deployment must use the Cloud Run gateway URL in `NEXT_PUBLIC_MIDTS_GATEWAY_URL`; it must not point directly to Apps Script.
