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

Known retained gap:

The deeper Vendor Request token to external Partner Technical Assessment submission bridge is not completed in this cleanup. Vendor Request and Vendor Pricing contracts remain unchanged in this branch.
