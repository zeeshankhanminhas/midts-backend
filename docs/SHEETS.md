# MIDTS Launch Sheet Schema

Create one Google Sheet for the clean backend launch: `MIDTS Operations`.

## Required Tabs

The backend creates or updates these by running `setupLaunchSheets()` from Apps Script.

```text
Leads
Webhook Logs
Email Logs
```

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
| Status | Initial value is `New`. |
| Raw Payload JSON | Audit copy of submitted payload. |

### Lifecycle Fields

| Column | Purpose |
| --- | --- |
| Lifecycle Status | Current lead lifecycle state. Starts as `New Lead`. |
| Review Status | Current review state. Starts as `Pending Review`. |
| Qualification Decision | Human decision: `Qualified`, `Needs More Info`, `Nurture`, or `Not Suitable`. |
| Human Approval | Human approval marker before routing. |
| Reviewer | Person who reviewed the lead. |
| Review Notes | Human review notes. |
| Decision Timestamp | Time the human decision was made. |
| Next Action | The next visible action. Starts as `Review lead`. |
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
| Quote Status | Quote state, such as `Draft Needed`, `Sent`, or `Approved`. |
| Quote Document Link | Route/link to the existing frontend Quote. |
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

## Webhook Logs

| Column | Purpose |
| --- | --- |
| Logged At | Timestamp of attempt. |
| Request ID | Backend request identifier. |
| Outcome | `success`, `rejected`, `failed`, or `error`. |
| Message | Short status/error message. |
| Submission ID | Frontend submission ID if available. |
| Email | Submitted email if available. |
| Source | Source label. |
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

## Launch Rule

A website submission is not considered fully complete unless:

1. The response body returns `ok: true`.
2. A row appears in `Leads`.
3. `Lifecycle Status` is `New Lead`.
4. `Review Status` is `Pending Review`.
5. `Next Action` is `Review lead`.
6. A corresponding `success` row appears in `Webhook Logs`.
7. A client acknowledgement `sent` row appears in `Email Logs`.
8. An internal review notification `sent` row appears in `Email Logs`.
