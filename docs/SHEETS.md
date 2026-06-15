# MIDTS Launch Sheet Schema

Create one new Google Sheet for the clean backend launch.

## Required Tabs

The backend can create these automatically by running `setupLaunchSheets()` from Apps Script.

### Leads

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
| Raw Payload JSON | Redacted audit copy of submitted payload. |

### Webhook Logs

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

### Email Logs

| Column | Purpose |
| --- | --- |
| Logged At | Timestamp of email attempt. |
| Lead ID | Backend lead identifier. |
| Submission ID | Frontend submission ID if available. |
| Recipient Email | Client email address. |
| Internal Copy Email | MIDTS copy/BCC address. |
| Subject | Email subject sent to the client. |
| Status | `sent`, `failed`, or `skipped`. |
| Message | Delivery result or error message. |

## Launch Rule

A website submission is not considered fully complete unless:

1. The response body returns `ok: true`.
2. A row appears in `Leads`.
3. A corresponding `success` row appears in `Webhook Logs`.
4. A corresponding `sent` row appears in `Email Logs`.
