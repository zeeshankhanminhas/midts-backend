# MIDTS Launch Sheet Schema

Create one Google Sheet for the clean backend launch: `MIDTS Operations`.

## Required Tabs

The backend creates or updates these by running `setupLaunchSheets()` from Apps Script.

```text
Leads
Technical Intake
Technical Reviews
Vendor Pricing
Webhook Logs
Email Logs
```

Later lifecycle services also create controlled operational tabs such as `Vendor Safe Packages`, `Projects`, `Delivery Records`, `Handover Records`, `Invoices`, `Vendor Requests`, `Quote Responses`, and `Documents` when those slices are active.

## Leads

The `Leads` tab is the operational control panel. It must show where each lead is, what happened, and what should happen next.

### Intake Fields

| Column | Purpose |
| --- | --- |
| Lead ID | Backend-generated lead identifier. |
| Created At | Timestamp when backend wrote the lead. |
| Submission ID | Frontend submission ID, if supplied. |
| Full Name | Client name. |
| Email | Client email. |
| Company | Client company, if supplied. |
| Project Type | Selected/requested project type. |
| Brief Requirement | Client requirement text. |
| Source | Website/source label. |
| Page URL | Submitting page URL, if supplied. |
| Status | Current broad lifecycle status. |
| Raw Payload JSON | Audit copy of submitted payload. |

### Lifecycle Fields

| Column | Purpose |
| --- | --- |
| Lifecycle Status | Current lead lifecycle state. |
| Review Status | Current technical/qualification review state. |
| Qualification Decision | Human decision: `Qualified`, `Needs More Info`, `Nurture`, or `Not Suitable`. |
| Human Approval | Human approval marker before routing. |
| Reviewer | Person who reviewed or approved the lead. |
| Review Notes | Technical Review summary mirrored from the detail tab. |
| Decision Timestamp | Time the Qualification decision was made. |
| Next Action | The next visible action. |
| Next Action Due | When the next action should happen. |

### Document Fields

| Column | Purpose |
| --- | --- |
| Capability Statement Required | Whether Capability Statement should be used. |
| Capability Statement Sent | Whether Capability Statement was sent. |
| Capability Statement Sent At | Timestamp when sent. |
| Capability Statement Link | Route/link to the existing frontend Capability Statement. |
| Quote Required | Whether quote path is required. |
| Quote Reference | Quote reference when created. |
| Quote Status | Quote state. |
| Quote Document Link | Route/link to the existing private Workspace Quote. |
| Quote Sent At | Timestamp when quote was sent. |

### Nurture And Closure Fields

| Column | Purpose |
| --- | --- |
| Nurture Status | Nurture lifecycle state. |
| Nurture Reason | Why the lead is in nurture. |
| Next Nurture Date | Future nurture follow-up date. |
| Nurture Attempts | Number of nurture touches. |
| Last Nurture Email Sent At | Timestamp of last nurture email. |
| Info Request Status | State of missing-information request. |
| Missing Information Needed | What MIDTS needs from the client. |
| Final Outcome | Final outcome: `Won`, `Lost`, `No Response`, `Not Suitable`, `Deferred`, or `Duplicate/Test`. |
| Close Reason | Reason for closure. |
| Closed At | Timestamp when closed. |
| Last Updated At | Last backend lifecycle update timestamp. |

## Technical Intake

| Column | Purpose |
| --- | --- |
| Technical Intake ID | Backend-generated Step 2 identifier. |
| Lead ID | Parent lead identifier. |
| Completed At | Timestamp for Step 2 completion. |
| Service Type / Technical Scope / Materials / Quantity / Deadline | Client technical requirement context. |
| Files Provided / File Links | File readiness and uploaded/reference links. |
| NDA Required / Confidentiality Notes | Confidentiality context. |
| Vendor Safe Package Required / Vendor Safe Package Ready | Vendor-safe routing context. |
| Budget Range / Timing Notes / Technical Notes | Commercial and delivery context. |
| Raw Payload JSON | Audit copy of submitted Step 2 payload. |

## Technical Reviews

| Column | Purpose |
| --- | --- |
| Technical Review ID | Backend-generated review identifier. |
| Lead ID | Parent lead identifier. |
| Technical Intake ID | Step 2 record used for the review. |
| Created At | Timestamp when review was recorded. |
| Reviewer | Workspace reviewer. |
| Review Status | Review row status, normally `Completed`. |
| Review Summary | Technical assessment. |
| File Review | File/drawing observations as JSON list. |
| Risks | Risk notes as JSON list. |
| Clarifications | Clarification notes as JSON list. |
| Recommendation | `Qualified`, `Needs More Info`, `Nurture`, or `Not Suitable`. |
| Approved At | Timestamp when Technical Review was completed. |
| Last Updated At | Last update timestamp. |
| Internal Notes | Internal-only notes from the Workspace reviewer. |

## Webhook Logs

| Column | Purpose |
| --- | --- |
| Logged At | Timestamp of attempt. |
| Request ID | Backend request identifier. |
| Outcome | Success, rejected, failed, duplicate, guard, or error outcome. |
| Message | Short status/error message. |
| Submission ID | Frontend submission ID or lead reference if available. |
| Email | Submitted email if available. |
| Source | Source route/service label. |
| Payload JSON | Redacted submitted payload. |

## Email Logs

| Column | Purpose |
| --- | --- |
| Logged At | Timestamp of email attempt. |
| Lead ID | Backend lead identifier. |
| Submission ID | Frontend submission ID if available. |
| Recipient Email | Email recipient. |
| Internal Copy Email | MIDTS copy/BCC address where used. |
| Subject | Email subject. |
| Status | `sent`, `failed`, or `skipped`. |
| Message | Delivery result or error message. |

## Workspace Queue Rules

### Pending Technical Reviews

A lead appears in `/workspace/technical-review` when:

1. Step 2 is complete.
2. `Review Status` is `Pending Review` or equivalent.
3. A matching `Technical Intake` row exists.
4. No completed `Technical Reviews` row exists for that lead.

### Pending Qualification Decisions

A lead appears in `/workspace/qualification` when:

1. A completed `Technical Reviews` row exists for the lead.
2. `Qualification Decision` is blank.
3. `Human Approval` is not `Approved`.

## Launch Rule

A lifecycle pass is not considered complete unless:

1. Step 1 returns `ok: true` and writes `Leads` plus `Webhook Logs`.
2. Step 2 writes `Technical Intake`, updates `Leads`, and logs/email-notifies internally.
3. Technical Review writes `Technical Reviews`, updates `Leads`, and logs `technical_review_success`.
4. Qualification Decision updates `Leads`, sends/logs the correct outcome email, and records the decision outcome in `Webhook Logs`.
