# MIDTS Compliance Boundaries

This document records the current operating rules for the MIDTS commercial backend. These rules extend the existing vertical-slice architecture; they do not introduce a replacement architecture.

## 1. Architecture Direction

Workspace is the human control layer for commercial operations.

The Cloud Run gateway remains the only frontend-to-backend transport path. Apps Script remains the backend/data layer for Sheets, Drive, document-generation support, and email transport.

Backend actions must keep the existing action/formStage contracts where they are already working. New backend capability should be exposed through the same gateway and Apps Script router pattern.

## 2. Document Suite Ownership Boundary

The Document Suite belongs only under protected Workspace document surfaces. Public routes must not expose document-generation or document-review controls.

Apps Script may store snapshots, update document rows, generate Drive files, and send email. It must not become the business UI for document approval, quote approval, qualification, or lifecycle decisions.

Client-facing output must not contain vendor cost, MIDTS margin, MIDTS profit, vendor notes, internal notes, or system-only audit identifiers unless intentionally exposed as a client reference.

## 3. Controlled Engineering Document Standard

Controlled document status is limited to:

- Draft
- Under Review
- Approved
- Issued
- Superseded
- Withdrawn

Purpose of issue is separate from status and is limited to:

- For Information
- For Review
- For Approval
- For Quotation
- For Delivery

Technical outcome is separate from both status and business qualification:

- Feasible
- Feasible with Assumptions
- Clarification Required
- Outside Available Capability
- Not Feasible

`Qualified` is a MIDTS business decision. `PDF Generated` is a system event. Neither value is a controlled engineering document status.

Production controlled documents must fail closed when required data is missing. Apps Script must not silently insert sample prices, names, scope, or terms into production snapshots. Sample previews are allowed only when clearly marked `UNCONTROLLED SAMPLE`.

Document rows must preserve revision history and system events separately from status. Previously issued revisions should be superseded when a new controlled revision is created and issued.

## 4. Outsourced Partner Assessment Model

MIDTS does not pretend to perform outsourced technical feasibility internally.

The existing `recordTechnicalReview` action remains the compatibility contract, but the stored workflow is Partner Technical Assessment. Approved outsourced partners provide the technical feasibility outcome. MIDTS controls qualification and commercial decisions after that outcome is recorded.

MIDTS must not override a partner `Not Feasible` or `Outside Available Capability` outcome into a qualified business decision. Qualification may proceed only when the partner technical outcome is `Feasible` or `Feasible with Assumptions`, and assumptions must be recorded when used.

Partner assessments must record the assessment scope, files and revisions reviewed, review package link, assessment document link, feasibility status, assumptions, risks, clarifications, partner declaration, and MIDTS business recommendation separately.
