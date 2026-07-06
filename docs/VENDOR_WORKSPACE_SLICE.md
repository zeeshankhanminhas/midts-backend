# Vendor Workspace Slice

Mission 2 moves Vendor Safe Package and Vendor Request Setup into the same Workspace -> Gateway -> Apps Script lifecycle used by Technical Review and Qualification.

## Architecture Confirmation

The Vendor workflow can reuse the existing gateway pattern.

The approved request lifecycle remains:

```text
Workspace page
-> Cloud Run gateway validation
-> Apps Script WebhookRouter
-> existing service
-> Sheets / Drive / Email / Webhook Logs
-> JSON response
-> Workspace success or error state
```

No new backend architecture is introduced. Apps Script remains the backend engine and the Cloud Run gateway remains the only frontend submission target.

## Implemented Transactions

| # | Transaction | Workspace route | Gateway payload | Apps Script service | Primary writes |
|---:|---|---|---|---|---|
| 8 | Vendor Safe Package | `/workspace/vendor-safe` -> `/workspace/vendor-safe/package?leadId=<leadId>` | `formStage=vendorSafePackage`, `action=recordVendorSafePackage`, hidden `leadId`, `reviewer` | `VendorPricingService.markVendorSafePackageReady` -> `VendorSafePackageService.preparePackage` | `Vendor Safe Packages`, `Leads`, `Webhook Logs` |
| 9 | Vendor Request Setup | `/workspace/vendor-request` -> `/workspace/vendor-request/setup?leadId=<leadId>` | `formStage=vendorRequestSetup`, `action=setupVendorRequest`, hidden `leadId`, vendor details, package link, file confirmation | `VendorRequestService.createAndSendRequest` | `Vendor Requests`, `Leads`, `Email Logs`, `Webhook Logs` |
| 10 | Vendor Pricing | `/vendor-pricing?requestId=<requestId>&token=<token>` | `formStage=vendorPricing`, `action=vendorPricing`, `requestId`, `token`, pricing fields | `VendorRequestService.handleVendorPricingSubmission` -> `VendorPricingService.recordVendorPricing` | `Vendor Requests`, `Vendor Pricing`, `Leads`, `Email Logs`, `Webhook Logs` |

## Workspace Reads

`WorkspaceReadService` now exposes:

- `listPendingVendorSafePackages`
- `listPendingVendorRequestSetups`

Both use live sheet data. There are no seeded workspace records.

## Identifier Rule

Workspace users do not manually type system identifiers. The selected lead is passed through route/query state and hidden payload only.

Editable user inputs are limited to operational human inputs:

- Vendor name
- Vendor email
- Approved vendor-safe package link
- Vendor-safe file confirmation

## Deployment Notes

After merge, deploy backend in this order:

```bash
git pull --ff-only origin main
clasp push
clasp version "Vendor workspace slice"
clasp deploy --deploymentId <WEB_APP_DEPLOYMENT_ID> --versionNumber <VERSION_NUMBER>
gcloud run deploy <GATEWAY_SERVICE_NAME> --source gateway --region <REGION> --project <PROJECT_ID>
```

Set Apps Script `VENDOR_PRICING_FORM_URL` to the live frontend vendor pricing route so vendor emails open the frontend page:

```text
https://<frontend-domain>/vendor-pricing
```

## Verification Checklist

1. `/workspace/vendor-safe` loads live qualified leads waiting for vendor-safe package preparation.
2. The action opens `/workspace/vendor-safe/package?leadId=<leadId>`.
3. The selected page shows lead, client, project, Technical Review, and lifecycle context.
4. No editable Lead ID field appears.
5. Marking package ready posts through gateway and writes `Vendor Safe Packages`, updates `Leads`, and logs success.
6. The lead appears in `/workspace/vendor-request` after refresh.
7. The action opens `/workspace/vendor-request/setup?leadId=<leadId>`.
8. Sending a vendor request writes `Vendor Requests`, updates `Leads -> Vendor Pricing Status = Vendor Request Sent`, sends the vendor email, and logs success.
9. Vendor email opens `/vendor-pricing?requestId=<requestId>&token=<token>`.
10. Vendor pricing submission writes `Vendor Pricing`, updates `Vendor Requests`, moves lead to Margin Review, and sends/logs the next workflow email.
