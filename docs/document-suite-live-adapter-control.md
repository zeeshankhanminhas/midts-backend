# Document Suite Live Adapter Control

Apps Script remains the MIDTS backend/data layer for document generation inputs. Workspace owns human workflow control.

A Document Suite template is not launch-ready just because the React template exists. Before final issue/render, each document must have a backend adapter or read service that assembles the document from live records.

Adapter rule:

1. Use existing gateway and `formStage=workspaceRead` for protected reads.
2. Map only real Lead, Technical Intake, Technical Review, Vendor Safe Package, Vendor Pricing, Quote, Project, Drive, and Document sheet fields.
3. Use controlled empty states only where data is genuinely unavailable:
   - Awaiting Confirmation
   - Not Applicable
   - Not Provided
4. Return `issueBlocked=true` and `missingRequiredFields` when required live fields are missing.
5. Do not silently render client-facing or partner-facing final documents from static preview data.

Current live-backed adapter/read:

- `getCommercialQualificationRecord`
  - action: `getCommercialQualificationRecord`
  - formStage: `workspaceRead`
  - data source: Leads, Technical Intake, Technical Reviews

Remaining document templates must stay preview-only until their own live adapters are implemented.