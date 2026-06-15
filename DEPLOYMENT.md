# Deployment Checklist

This backend is deployed to a new Google Apps Script project.

## 1. Create A New Google Sheet

Create a new launch sheet, for example:

```text
MIDTS Launch Leads
```

Copy the spreadsheet ID from the URL.

## 2. Create A New Apps Script Project

Create a new standalone Apps Script project.

Do not reuse the old Apps Script project.

## 3. Connect Repo To Apps Script On Local Machine

On the iMac, install and authenticate clasp, then clone this repo.

Copy `.clasp.json.example` to `.clasp.json` and insert the new Apps Script project ID.

Then push the `src` folder to Apps Script.

## 4. Set Script Properties

In Apps Script project settings, add:

```text
WEBSITE_WEBHOOK_TOKEN=<strong-shared-secret>
SPREADSHEET_ID=<new-google-sheet-id>
```

The frontend GitHub/hosting build variables must use:

```text
NEXT_PUBLIC_MIDTS_WEBHOOK_URL=<new-apps-script-exec-url>
NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN=<same-value-as-WEBSITE_WEBHOOK_TOKEN>
```

## 5. Initialize Sheets

In Apps Script, run:

```text
setupLaunchSheets
```

Approve permissions when prompted.

## 6. Deploy Web App

Deploy as Web App:

```text
Execute as: Me
Who has access: Anyone
```

Use the `/exec` URL only. Do not use `/dev` for the website.

## 7. Prove The Backend Before Connecting Frontend

Run:

```text
testWebsiteWebhookWithSampleLead
testWebhookRouterWithSamplePost
```

Both must create rows before the frontend is pointed at the endpoint.

## 8. Connect Frontend

Only after backend tests pass, update frontend hosting/build secrets and rebuild the frontend.
