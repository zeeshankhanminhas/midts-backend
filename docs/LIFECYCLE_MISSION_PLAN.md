# MIDTS Lifecycle Mission Plan

## Mission

Process one real client enquiry through a visible, controlled MIDTS lifecycle by Sunday.

Automation moves the lead. Human approval controls business decisions.

## Repository Boundary

`midts-backend` owns:

- Website intake endpoint
- Lead lifecycle state
- Google Sheet workflow
- Email notifications
- Logs
- Document status tracking fields

`NEW-MIDTS` owns:

- Website frontend
- Document renderer
- Capability Statement
- Quote template
- Visual document presentation

Apps Script is a deployment target only.

## Lifecycle

```text
Website Enquiry
-> Lead Logged
-> Client Acknowledged
-> Internal Review
-> Human Decision
-> Outcome Path
-> Document Action
-> Follow-up / Quote / Nurture / Close
-> Final Status
```

## Human Decisions

Only these business decisions are allowed for the first launch workflow:

```text
Qualified
Needs More Info
Nurture
Not Suitable
```

Automation must not guess these decisions.

## Stage 1: Lead Intake

Creates:

- Lead row
- Webhook log
- Initial lifecycle state

Initial state:

```text
Status = New
Lifecycle Status = New Lead
Review Status = Pending Review
Next Action = Review lead
```

## Stage 2: Client Acknowledgement

Sends a receipt email to the client.

Logs:

```text
Email Logs -> sent / failed / skipped
```

## Stage 3: Internal Review Notification

Sends MIDTS an internal review email containing:

- Lead ID
- Client name
- Client email
- Company
- Project type
- Brief
- Required human decision list

## Stage 4: Human Review

Human updates:

```text
Qualification Decision
Human Approval
Reviewer
Review Notes
Decision Timestamp
```

## Stage 5: Outcome Routing

After the human decision:

```text
Qualified -> Quote Required
Needs More Info -> Info Request Required
Nurture -> Nurture Scheduled
Not Suitable -> Closed / Close Required
```

Outcome automation should be added only after the paper logic is approved.

## Stage 6: Document Suite Use

Existing documents are tracked, not moved into this repo.

Tracked fields:

```text
Capability Statement Required
Capability Statement Sent
Capability Statement Sent At
Capability Statement Link
Quote Required
Quote Reference
Quote Status
Quote Document Link
Quote Sent At
```

## Stage 7: Nurture Cycle

Minimum nurture tracking:

```text
Nurture Status
Nurture Reason
Next Nurture Date
Nurture Attempts
Last Nurture Email Sent At
```

No complex drip campaign until one manual lifecycle passes.

## Stage 8: Closure

No lead should be left unclear.

Final fields:

```text
Final Outcome
Close Reason
Closed At
Last Updated At
```

## Launch Rehearsal Pass Condition

One test lead must prove:

- Lead row created
- Webhook success logged
- Client acknowledgement sent
- Internal review notification sent
- Email Logs contains both sent entries
- Human decision can be recorded
- Document/quote/nurture fields are visible
- Lead has a next action or final outcome
