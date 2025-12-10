# Complete Translation Migration Plan

## Summary
The frontend has **extensive untranslated text** across all major routes. You need to add ~150 new translation keys and update 8-10 major component files.

## Current Status
- ✅ Settings page: Fully translated
- ✅ Dashboard: Partially translated
- ✅ Sidebar: Fully translated  
- ❌ Login/Register: 0% translated
- ❌ Monitors: 0% translated (778 lines!)
- ❌ Heartbeats: 0% translated
- ❌ Notifications: 0% translated
- ❌ Incidents: 0% translated
- ❌ Maintenance: 0% translated
- ❌ Status Pages: 0% translated

---

## Phase 1: Add New Translation Keys

### New Keys Needed (~150 total)

#### Login/Register (10 keys)
```typescript
welcomeBack: "Welcome back"
createAccount: "Create account"
useEmailPassword: "Use your email + password to continue."
provisionCredentials: "Provision your operator credentials."
signIn: "Sign in"
working: "Working…"
needAccount: "Need an account?"
alreadyOnboard: "Already onboard?"
uptivalab: "UptivaLab"
```

#### Monitors - Form Labels (30+ keys)
```typescript
createNewMonitor: "Create new monitor"
advancedOptions: "Advanced options"
httpOptions: "HTTP options"
interval: "Interval"
timeout: "Timeout"
retries: "Retries"
retryInterval: "Retry interval"
description: "Description"
tags: "Tags"
selectNotifications: "Select notifications"
ignoreTls: "Ignore TLS/SSL errors"
upsideDown: "Upside down mode"
maxRedirects: "Max redirects"
acceptedStatusCodes: "Accepted status codes"
method: "Method"
headers: "Headers"
body: "Body"
bodyEncoding: "Body encoding"
authMethod: "Auth method"
authUsername: "Username"
authPassword: "Password"
host: "Host"
port: "Port"
url: "URL"
record: "DNS Record"
recordType: "Record Type"
containerName: "Container Name"
connectionString: "Connection String"
variant: "Database Type"
target: "gRPC Target"
heartbeatSeconds: "Heartbeat Interval (seconds)"
viewDetails: "View details"
lastCheck: "Last check"
deleteMonitorConfirm: "Delete monitor"
showAdvanced: "Show advanced options"
hideAdvanced: "Hide advanced options"
showHttpOptions: "Show HTTP options"
hideHttpOptions: "Hide HTTP options"
```

#### Heartbeats (15 keys)
```typescript
createHeartbeatToken: "Create Heartbeat Token"
generateHeartbeatUrl: "Generate a heartbeat URL to monitor cron jobs and scheduled tasks."
monitorCronJobs: "Monitor cron jobs and scheduled tasks"
heartbeatEvery: "Heartbeat every"
noPushMonitors: "No Push/Heartbeat monitors found"
noPushMonitorsDesc: "You need to create a Push/Heartbeat monitor first before you can generate heartbeat tokens."
createPushMonitorFirst: "Create a Push/Heartbeat monitor first"
goToMonitors: "Go to Monitors"
allPushHaveTokens: "All push monitors already have heartbeat tokens"
deleteExistingToken: "Delete an existing token below if you need to create a new one."
deleteHeartbeatConfirm: "Delete heartbeat token"
heartbeatUrl: "Heartbeat URL"
heartbeatUrlCopied: "Heartbeat URL copied to clipboard!"
copyUrl: "Copy URL"
activeHeartbeats: "Active Heartbeats"
```

#### Notifications (25 keys)
```typescript
createNotificationChannel: "Create Notification Channel"
notificationType: "Notification Type"
emailAddress: "Email Address"
smtpHost: "SMTP Host"
smtpPort: "SMTP Port"
smtpUser: "SMTP Username"
smtpPass: "SMTP Password"
smtpFrom: "From Email (optional)"
ntfyTopic: "ntfy.sh Topic"
webhookUrl: "Webhook URL"
discordWebhook: "Discord Webhook URL"
slackWebhook: "Slack Webhook URL"
telegramBotToken: "Bot Token"
telegramChatId: "Chat ID"
gotifyServerUrl: "Gotify Server URL"
gotifyAppToken: "App Token"
pushoverUserKey: "User Key"
pushoverApiToken: "API Token"
appriseUrl: "Apprise URL"
deleteNotificationConfirm: "Delete notification channel"
testNotification: "Test notification"
notificationName: "Notification Name"
notificationConfig: "Configuration"
manageNotifications: "Manage notification channels"
```

#### Incidents (15 keys)
```typescript
filters: "Filters"
allStatuses: "All Statuses"
open: "Open"
investigating: "Investigating"
mitigated: "Mitigated"
resolved: "Resolved"
sortBy: "Sort by"
date: "Date"
duration: "Duration"
viewDetails: "View Details"
updateStatus: "Update Status"
incidentEvents: "Incident Events"
addUpdate: "Add Update"
latestUpdate: "Latest update"
noUpdatesYet: "No updates yet."
allMonitors: "All Monitors"
```

#### Maintenance (15 keys)
```typescript
createMaintenanceWindow: "Create Maintenance Window"
editMaintenanceWindow: "Edit Maintenance Window"
windowName: "Window Name"
startTime: "Start Time"
endTime: "End Time"
affectedMonitors: "Affected Monitors"
selectMonitors: "Select monitors"
schedulePlannedDowntime: "Schedule planned downtime to suppress alerts during maintenance"
deleteMaintenanceConfirm: "Delete maintenance window"
activeMaintenanceWindows: "Active Maintenance Windows"
upcomingMaintenance: "Upcoming Maintenance"
pastMaintenance: "Past Maintenance"
noActiveMaintenance: "No active maintenance"
maintenanceSchedule: "Maintenance Schedule"
```

#### Status Pages (15 keys)
```typescript
externalFacing: "External facing"
publishTransparency: "Publish realtime transparency to stakeholders."
newPage: "New page"
statusPageHeroMessage: "Hero Message"
showIncidents: "Show Incidents"
showMaintenance: "Show Maintenance"
publicUrl: "Public URL"
viewPublicPage: "View public page"
deleteStatusPageConfirm: "Delete status page"
selectMonitorsForPage: "Select monitors for this page"
statusPageSlug: "Page Slug"
statusPageName: "Page Name"
heroMessage: "Hero Message (optional)"
publicStatusPages: "Public Status Pages"
```

#### Common UI (20 keys)
```typescript
optional: "optional"
required: "required"
placeholder: "placeholder"
noData: "No data"
noResults: "No results"
loadingData: "Loading data..."
success: "Success"
warning: "Warning"
info: "Info"
copyToClipboard: "Copy to clipboard"
copiedToClipboard: "Copied to clipboard"
confirmDelete: "Confirm Delete"
areYouSure: "Are you sure?"
loadingEllipsis: "Loading…"
submit: "Submit"
apply: "Apply"
reset: "Reset"
clear: "Clear"
selectAll: "Select all"
deselectAll: "Deselect all"
```

---

## Phase 2: Update Component Files

### Priority Order (Start with most visible):

1. **apps/web/src/routes/login.tsx** (smallest, ~80 lines)
2. **apps/web/src/routes/heartbeats.tsx** (~188 lines)
3. **apps/web/src/routes/incidents.tsx** (~223 lines)
4. **apps/web/src/routes/notifications.tsx** (~245 lines)
5. **apps/web/src/routes/maintenance.tsx** (~259 lines)
6. **apps/web/src/routes/status-pages.tsx** (~281 lines)
7. **apps/web/src/routes/monitors.tsx** (~778 lines - LARGEST!)
8. **apps/web/src/routes/monitor-detail.tsx** (if needed)

---

## Implementation Steps

### Step 1: Extend i18n.ts

Add all 150 new keys to `apps/web/src/lib/i18n.ts` in:
- ✅ English (en)
- ✅ Spanish (es)
- ✅ German (de)
- ✅ French (fr)
- ✅ Chinese (zh)
- ✅ Japanese (ja)

**Total additions: ~900 lines** (150 keys × 6 languages)

### Step 2: Update Each Component

For each component file:

1. Import `useTranslation` hook:
```typescript
import { useTranslation } from "../hooks/use-translation.js";
```

2. Use hook in component:
```typescript
const { t } = useTranslation();
```

3. Replace ALL hardcoded strings:
```typescript
// Before:
<h1>Welcome back</h1>

// After:
<h1>{t("welcomeBack")}</h1>
```

---

## Example Conversion

### Login.tsx - Before:
```typescript
<h1 className="text-3xl font-semibold text-white">
  {mode === "login" ? "Welcome back" : "Create account"}
</h1>
<p className="text-sm text-slate-400">
  {mode === "login" ? "Use your email + password to continue." : "Provision your operator credentials."}
</p>
```

### Login.tsx - After:
```typescript
<h1 className="text-3xl font-semibold text-white">
  {mode === "login" ? t("welcomeBack") : t("createAccount")}
</h1>
<p className="text-sm text-slate-400">
  {mode === "login" ? t("useEmailPassword") : t("provisionCredentials")}
</p>
```

---

## Testing Plan

After all updates:

1. Switch to **Spanish** in settings → Verify all text changes
2. Switch to **German** → Verify
3. Switch to **French** → Verify
4. Switch to **Chinese** → Verify
5. Switch to **Japanese** → Verify
6. Test all pages: Login, Monitors, Heartbeats, Incidents, Maintenance, Status Pages, Notifications

---

## Estimated Effort

- **Adding translations**: 2-3 hours (manual translation or use AI)
- **Updating components**: 3-4 hours (systematic find/replace)
- **Testing**: 1 hour
- **Total**: 6-8 hours of work

---

## Quick Start Command

I can help you do this step-by-step! Would you like me to:

**Option A**: Add all 150 translation keys first (will take multiple file edits)
**Option B**: Start with one small file (login.tsx) to show the complete workflow
**Option C**: Generate a script to help automate the string replacement

Let me know which approach you'd prefer!

---

## Notes

- The current i18n file has ~161 keys
- After this migration: ~311 total keys
- All 6 languages must be kept in sync
- Spanish, German, French, Chinese, Japanese translations can be AI-generated if needed
- TypeScript will catch any missing keys via the `TranslationKey` type
