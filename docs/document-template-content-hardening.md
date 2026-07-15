# Document Template Content Hardening

Branch: `feature/document-template-content-hardening`

## Backend Boundary

The backend remains the data, Drive, Sheets, email, and document-generation support layer. It must not become a business UI and must not introduce a parallel Google Docs document path.

The controlled document lifecycle remains:

1. Workspace owns the workflow state.
2. Backend read/write actions expose canonical business objects.
3. Canonical document adapters shape those objects for the Document Suite.
4. The existing Workspace Document Suite previews the document.
5. The existing PDF renderer creates the PDF.
6. Backend/Apps Script records Drive and Documents-sheet audit references.

## Template Coverage Expected By The Frontend Document Suite

The frontend sprint branch now includes hardened Workspace previews for:

| Stage | Template | Purpose |
| --- | --- | --- |
| 3 | Commercial Qualification Record | Internal commercial fit and decision record. |
| 4 | Vendor Safe Package Cover Sheet | Controlled package issue cover. |
| 4 | Scope of Work | Partner-safe delivery scope. |
| 4 | Client Requirements | Traceable requirement statement from client intake. |
| 5 | Partner Technical Assessment Report | Partner assessment outcome and feasibility basis. |
| 6 | RFQ Response / Vendor Pricing | Partner commercial response structure. |
| 4-6 | Vendor Instructions | Instructions, rules, and response requirements for partners. |
| 4-10 | Document Register | Controlled package index and generated-file audit. |
| 7 | Internal Commercial Approval Record | Margin and quote approval basis. |
| 8-9 | Client Quote | Client-facing commercial quote content. |

## Backend Requirements For Live Generation

When these templates are connected to live generation, backend adapters should provide the same canonical fields from existing sheets and services instead of manually entered identifiers or query-string values.

Do not change existing action names, gateway routing, sheet names, or Apps Script deployment architecture for this content-hardening sprint unless a live contract mismatch is found.
