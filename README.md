# NEXT Web — Upload & Insights (Azure Static Web Apps)

This SPA lets you **upload the NEXT workbook** *or* the **raw exports** (Review Orders + Event Viewer), then renders the canonical NEXT view plus insights (signature compliance, GPS zeros, duplicates log, drivers leaderboard).

## Quick Start
Open `web/index.html` locally in a browser. Everything runs client-side.

## Azure SWA
1. Create a **Static Web App** in Azure; choose **GitHub** as the source.
2. Set `app_location` to `web` and `api_location` to `api` (optional).
3. Configure **Entra ID** (AAD) provider on the SWA resource if you want auth.
