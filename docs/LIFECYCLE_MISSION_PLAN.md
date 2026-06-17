# MIDTS Lifecycle Mission Plan

## Mission

Process one real client enquiry through a visible, controlled MIDTS lifecycle by Sunday.

Automation moves the lead. Human approval happens by email decision link. The Sheet is operational visibility, not the manual control surface.

## Repository Boundary

`midts-backend` owns:

- Website intake endpoint
- Lead lifecycle state
- Google Sheet workflow
- Email notifications
- Decision links
- Outcome routing
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
-> Internal Review Email
-> Human Clicks Decision Link
-> Outcome Path Applied
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
- Four decision links

Decision links:

```text
Qualified
Needs More Info
Nurture
Not Suitable
```

## Stage 4: Human Review By Link

Human clicks exactly one decision link from the internal review email.

The decision handler updates:

```text
Qualification Decision
Human Approval
Reviewer
Decision Timestamp
Lifecycle Status
Review Status
Next Action
Next Action Due
Last Updated At
```

No manual Sheet update is required for the decision.

## Stage 5: Outcome Routing

After the decision link:

```text
Qualified -> Quote Path
Needs More Info -> Info Required
Nurture -> Nurture Scheduled
Not Suitable -> Closed
```

Current first-pass routing:

```text
Qualified -> Quote Required = Yes, Quote Status = Draft Needed, Next Action = Prepare quote
Needs More Info -> Info Request Status = Required, Next Action = Send info request
Nurture -> Nurture Status = Scheduled, Next Nurture Date = +7 days, Next Action = Nurture follow-up
Not Suitable -> Final Outcome = Not Suitable, Closed At = now, Next Action = None
```

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

No complex drip campaign until one lifecycle passes.

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
- Internal email contains four decision links
- Clicking one decision link updates the lead row
- Decision is logged
- Lead has a next action or final outcome
