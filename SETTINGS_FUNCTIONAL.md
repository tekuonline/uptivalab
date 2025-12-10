# UptivaLab Settings - Functional Implementation

## ✅ Fully Functional Settings

### **Theme & Appearance**
- **Theme Selection** (Auto/Light/Dark)
  - Automatically applies to the UI in real-time
  - Auto mode follows system preference
  - Persisted across sessions
  - Changes detected dynamically
  
- **Language**
  - Sets `document.documentElement.lang` attribute
  - Foundation for future i18n implementation

### **Search Engine Visibility**
- **robots.txt Generation** (`/robots.txt`)
  - "Allow" mode: Allows crawling, disallows `/api/` and `/status/`
  - "Discourage" mode: Blocks all crawlers with `Disallow: /`
  - Updates dynamically based on setting

### **Settings Caching**
- **SettingsService** with intelligent caching
  - 1-minute cache TTL
  - Automatic cache invalidation on updates
  - Reduces database queries for frequently accessed settings

### **Settings Context Provider**
- Global settings available via `useSettings()` hook
- Real-time theme application
- Language attribute management
- Automatic refetching on auth changes

### **API Key Management**
- Generate new API keys with custom labels
- Keys prefixed with `ulk_`
- One-time token display (security feature)
- View creation and last used dates
- Delete unused keys
- Token hashing with Argon2

### **Docker Hosts Management**
- Add/remove Docker daemon connections
- Support for Unix sockets and TCP
- Stored in database, accessible via API
- Ready for Docker monitor integration

### **Remote Browsers**
- Configure WebSocket URLs for remote browsers
- Used for synthetic monitoring
- Full CRUD operations via API

### **Proxies**
- HTTP/HTTPS/SOCKS4/SOCKS5 support
- Optional authentication
- Accessible to monitors for making requests
- Full management UI

### **Security**
- **Password Change**
  - Current password verification
  - Min 8 characters validation
  - Show/hide password toggle
  - Argon2 hashing

### **Data Persistence**
- All settings stored in PostgreSQL
- JSON flexible schema
- Settings synced across app restarts

## 🔧 Backend Services

### **SettingsService** (`apps/api/src/services/settings/service.ts`)

**Available Methods:**
```typescript
// Generic
get<T>(key: string, defaultValue?: T): Promise<T | undefined>
set(key: string, value: any): Promise<void>
getAll(): Promise<Record<string, any>>
clearCache(key?: string): void

// Specific Settings
getChromeExecutable(): Promise<string | undefined>
getDockerHosts(): Promise<DockerHost[]>
getProxies(): Promise<Proxy[]>
getRemoteBrowsers(): Promise<RemoteBrowser[]>
getDisplayTimezone(): Promise<string>
getServerTimezone(): Promise<string>
isNscdEnabled(): Promise<boolean>
getSteamApiKey(): Promise<string | undefined>
getPrimaryBaseUrl(): Promise<string | undefined>
shouldTrustProxy(): Promise<boolean>
getReverseProxyHeaders(): Promise<string | undefined>
```

**Usage in Other Services:**
```typescript
import { settingsService } from "../services/settings/service.js";

// Get Chrome executable for synthetic monitoring
const chromePath = await settingsService.getChromeExecutable();

// Get all Docker hosts for Docker monitors
const hosts = await settingsService.getDockerHosts();

// Get proxies for HTTP monitors
const proxies = await settingsService.getProxies();

// Get base URL for notification links
const baseUrl = await settingsService.getPrimaryBaseUrl();
```

## 📊 API Endpoints

All endpoints require authentication (`Authorization: Bearer {token}`):

```
GET    /api/settings                  # Get all settings
GET    /api/settings/:key             # Get specific setting
PUT    /api/settings/:key             # Update setting
POST   /api/settings/batch            # Batch update

POST   /api/settings/change-password  # Change password

GET    /api/settings/api-keys         # List API keys
POST   /api/settings/api-keys         # Create API key
DELETE /api/settings/api-keys/:id     # Delete API key

GET    /api/settings/docker-hosts     # List Docker hosts
POST   /api/settings/docker-hosts     # Add Docker host
DELETE /api/settings/docker-hosts/:id # Remove Docker host

GET    /api/settings/remote-browsers     # List remote browsers
POST   /api/settings/remote-browsers     # Add remote browser
DELETE /api/settings/remote-browsers/:id # Remove remote browser

GET    /api/settings/proxies         # List proxies
POST   /api/settings/proxies         # Add proxy
DELETE /api/settings/proxies/:id     # Remove proxy

GET    /robots.txt                    # Dynamic robots.txt
```

## 🎯 Ready for Integration

These settings are now ready to be used by other parts of the application:

### **Monitor Services**
- Docker monitors can use `settingsService.getDockerHosts()`
- HTTP monitors can use `settingsService.getProxies()`
- Synthetic monitors can use `settingsService.getChromeExecutable()`
- Steam monitors can use `settingsService.getSteamApiKey()`

### **Notification Services**
- Use `settingsService.getPrimaryBaseUrl()` for links in emails/webhooks
- Apply timezone from `settingsService.getDisplayTimezone()`

### **API Authentication**
- Validate API keys against stored hashes
- Track `lastUsedAt` timestamp

### **Reverse Proxy**
- Use `settingsService.shouldTrustProxy()` for X-Forwarded headers
- Apply custom headers from `settingsService.getReverseProxyHeaders()`

## 🔄 How Settings Propagate

1. **User changes setting in UI** → `setLocalSettings()`
2. **User clicks "Save"** → `updateGlobalSettings()` called
3. **Context updates settings** → Batch POST to `/api/settings/batch`
4. **Backend saves to DB** → Settings persisted
5. **Backend clears cache** → `settingsService.clearCache()`
6. **Context applies changes** → Theme/language updated immediately
7. **Other services fetch** → `settingsService.get()` retrieves fresh data

## 🚀 Next Steps for Full Functionality

To make ALL settings functional, you can:

1. **Integrate with Monitor Types:**
   - Update Docker monitor to use `getDockerHosts()`
   - Update HTTP monitor to use `getProxies()`
   - Update Synthetic monitor to use `getChromeExecutable()`
   
2. **Timezone Display:**
   - Import `formatDateWithTimezone()` from `/lib/timezone.ts`
   - Use in dashboard, monitor details, incident timelines
   
3. **Entry Page:**
   - Check `entryPage` setting in protected route
   - Redirect to dashboard or status page accordingly

4. **Cloudflare Tunnel:**
   - Add status check endpoint
   - Use token for tunnel configuration

5. **Two-Factor Authentication:**
   - Implement TOTP/WebAuthn
   - Add to security settings

6. **Notifications:**
   - Add global notification defaults
   - Quiet hours, rate limiting

## 📁 File Structure

```
apps/
├── api/src/
│   ├── routes/
│   │   ├── settings.ts          # Settings API routes
│   │   └── robots.ts            # Dynamic robots.txt
│   └── services/
│       └── settings/
│           └── service.ts       # Settings service with caching
│
└── web/src/
    ├── providers/
    │   └── settings-context.tsx # Global settings context
    ├── routes/
    │   └── settings.tsx         # Settings UI page
    └── lib/
        └── timezone.ts          # Timezone utilities
```

## ✨ Summary

**Implemented:**
- ✅ Theme switching with auto system detection
- ✅ Dynamic robots.txt based on SEO settings
- ✅ Settings caching service
- ✅ Global settings context
- ✅ API key management
- ✅ Docker hosts configuration
- ✅ Remote browsers configuration
- ✅ Proxies configuration
- ✅ Password management
- ✅ Complete REST API

**Ready to Use:**
- All settings are stored and retrievable
- Backend services can access settings
- Frontend can display and modify settings
- Changes persist across restarts

**Awaiting Integration:**
- Timezone formatting in UI components
- Entry page routing
- Cloudflare tunnel status
- 2FA implementation
- Monitor type integrations
