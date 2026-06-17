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
- Commercial status gates

`NEW-MIDTS` owns:

- Website frontend
- Document renderer
- Capability Statement
- Quote template
- Visual document presentation

Apps Script is a deployment target only.

## Sheet Tabs

The launch sheet should stay operationally clean with five tabs:

```text
Leads
Technical Intake
Vendor Pricing
Webhook Logs
Email Logs
```

`Leads` is the one-row summary. Detail belongs in the relevant detail tab, not in endless extra lead columns.

## Commercial Lifecycle

```text
Website Enquiry
-> Step 1 Lead Logged
-> Client Acknowledged With Step 2 Link
-> Step 2 Technical Intake Completed
-> Internal Review Email
-> Human Clicks Decision Link
-> Outcome Path Applied
-> Vendor Safe Package if required
-> Vendor Pricing
-> Margin Approval
-> Quote Preparation
-> Follow-up / Nurture / Close
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

## Stage 1: Website Lead Intake

Creates:

- Lead row
- Webhook log
- Initial lifecycle state
- Client acknowledgement email

Initial state:

```text
Status = Awaiting Step 2
Lifecycle Status = Awaiting Step 2
Review Status = Not Ready
Next Action = Client to complete Step 2
```

No internal decision email is sent at this stage.

## Stage 2: Client Technical Intake

The client completes Step 2 with project details, files/confidentiality flags, timing, and technical requirement notes.

Creates:

- Technical Intake row
- Updated Lead lifecycle summary
- Webhook log
- Internal review email

Updated state:

```text
Status = Step 2 Completed
Lifecycle Status = Pending Review
Review Status = Pending Review
Next Action = Review technical requirement
```

## Stage 3: Internal Review Notification

Sends MIDTS an internal review email containing:

- Lead ID
- Client name
- Client email
- Company
- Project type
- Brief
- Step 2 context
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

Duplicate and conflicting decision clicks are blocked and logged.

## Stage 5: Outcome Routing

After the decision link:

```text
Qualified -> Vendor Safe Review or Vendor Pricing
Needs More Info -> Info Required
Nurture -> Nurture Scheduled
Not Suitable -> Closed
```

Current first-pass routing:

```text
Qualified with vendor-safe package required -> Quote Status = Waiting Vendor Safe Package, Next Action = Prepare vendor-safe package
Qualified without vendor-safe blocker -> Quote Status = Waiting Vendor Price, Vendor Pricing Status = Contact Vendor, Next Action = Contact vendor
Needs More Info -> Info Request Status = Required, Next Action = Send info request
Nurture -> Nurture Status = Scheduled, Next Nurture Date = +7 days, Next Action = Nurture follow-up
Not Suitable -> Final Outcome = Not Suitable, Closed At = now, Next Action = None
```

## Stage 6: Vendor Pricing And Margin

Vendor pricing must happen before a commercial quote is issued.

Tracked in `Vendor Pricing`:

```text
Vendor Cost
Vendor Currency
Margin Type
Margin Value
MIDTS Profit Amount
Client Quote Amount
Pricing Status
Pricing Approved
Pricing Approved By
Pricing Approved At
Quote Revision
Latest Revision
Revision Reason
```

Margin can be changed during negotiation, but it must be versioned and approved. Open quotes should not be silently overwritten.

## Stage 7: Document Suite Use

Existing documents remain in `NEW-MIDTS` and are tracked by status only in the backend.

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

The launch-critical documents are:

```text
Capability Statement
Quote
```

## Stage 8: Nurture Cycle

Minimum nurture tracking:

```text
Nurture Status
Nurture Reason
Next Nurture Date
Nurture Attempts
Last Nurture Email Sent At
```

No complex drip campaign until one lifecycle passes.

## Stage 9: Closure

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

- Step 1 lead row created
- Step 1 webhook success logged
- Client acknowledgement sent with Step 2 instruction/link
- Step 2 technical intake row created
- Step 2 webhook success logged
- Internal review notification sent only after Step 2
- Email Logs contains client and internal sent entries
- Internal email contains four decision links
- Clicking one decision link updates the lead row
- Duplicate/conflicting decision protection still works
- Qualified lead does not jump straight to quote
- Qualified lead lands in vendor-safe review or vendor pricing
- Lead has a next action or final outcome
