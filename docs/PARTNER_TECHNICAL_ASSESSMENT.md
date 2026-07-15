# Partner Technical Assessment Backend Boundary

The backend preserves legacy internal contract names for compatibility while exposing Partner Technical Assessment wording to users.

Retained legacy/internal names:

- `Technical Reviews` sheet
- `TechnicalReviewService`
- `recordTechnicalReview`
- `technicalReview` form stage
- `listPendingTechnicalReviews`

Partner-facing/user-facing terminology:

- Partner Technical Assessment
- Partner assessor
- Partner organisation
- Partner assessment evidence
- Feasibility status

Current compatibility alias:

- `listPendingPartnerAssessments` is accepted by `WebhookRouter` and maps to the existing workspace read handler for pending assessment records.

Validation remains authoritative in `TechnicalReviewService` and `DecisionService`:

- partner assessor identity is required
- partner organisation is required
- files and revisions assessed are required
- partner assessment evidence link is required
- feasibility status is required
- MIDTS business recommendation remains separate from technical feasibility
- Qualification is blocked unless assessment evidence is complete

## Vendor Request Assessment Bridge

Vendor Request Setup remains a Workspace-controlled action. When MIDTS sends a vendor request, the backend now sends the partner the Partner Technical Assessment form first.

Flow:

1. Workspace sends `setupVendorRequest` through the gateway.
2. `VendorRequestService` creates the Vendor Request row and sends the partner assessment link.
3. The external partner opens `action=partnerAssessment` with the existing vendor request token.
4. The partner submits assessment evidence, feasibility, files/revisions reviewed, assumptions, risks, exclusions, lead time, and pricing-readiness declaration.
5. `VendorRequestService` stores the assessment by calling `TechnicalReviewService.recordReview` without changing the existing `recordTechnicalReview` backend contract.
6. Feasible or Feasible with Assumptions plus pricing-ready moves the lead to `Vendor Pricing` with `Vendor Pricing Status = Ready for Pricing`.
7. Clarification, alternative approach, not feasible, or outside capability block pricing and move the lead to the appropriate MIDTS decision state.
8. Vendor pricing submission is blocked until the latest Partner Technical Assessment is feasible and contains the required evidence fields.

The pricing form and direct `VendorPricingService.recordVendorPricing` path both enforce the same assessment prerequisite. This prevents a partner from bypassing the assessment bridge by opening an old pricing URL.

The bridge intentionally reuses:

- Apps Script web app routes
- existing Vendor Request token records
- existing Technical Reviews storage
- existing Vendor Pricing storage
- existing Workspace gateway actions

No new UI architecture, sheet names, or public document routes are introduced.
