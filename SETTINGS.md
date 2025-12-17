# Settings Feature Documentation

## Overview
UptivaLab now includes a comprehensive Settings page with Uptime Kuma-style configuration options.

## Access
Navigate to **Settings** from the sidebar to access all configuration options.

## Available Settings

### 1. **General**
- **Display Timezone**: Set the timezone for displaying dates and times
- **Server Timezone**: Configure the server's timezone
- **Search Engine Visibility**: Control search engine indexing
  - Allow indexing
  - Discourage search engines from indexing site
- **Entry Page**: Choose default landing page
  - Dashboard
  - Status Page
- **Primary Base URL**: Used for generating links in notifications
- **Steam API Key**: For monitoring Steam Game Servers
- **Enable NSCD**: Cache DNS requests for better performance
- **Chrome/Chromium Executable**: Path to browser for synthetic monitoring

### 2. **Appearance**
- **Language**: Choose interface language
  - English, Español, Français, Deutsch, 日本語, 中文
- **Theme**: Select color scheme
  - Auto (Follow system)
  - Light
  - Dark
- **Heartbeat Bar Theme**:
  - Normal
  - Bottom Up
- **Show Elapsed Time**: Display time under heartbeat bar

### 3. **Notifications**
Links to the Notifications page for channel configuration. Global notification settings coming soon.

### 4. **Reverse Proxy**
- **Cloudflare Tunnel**:
  - Shows cloudflared installation status
  - Configure Cloudflare Tunnel Token
  - Includes setup guide link
- **Other Software**:
  - Documentation for nginx, Apache, Traefik
  - Wiki link for setup instructions
- **HTTP Headers**: Custom headers for reverse proxy
- **Trust Proxy**: Trust X-Forwarded-* headers

### 5. **Docker Hosts**
Manage Docker daemon connections for Docker monitor type:
- Add Docker hosts by name and socket URL
- Supports both Unix sockets and TCP connections
- Examples:
  - Unix socket: `unix:///var/run/docker.sock`
  - TCP: `tcp://192.168.1.10:2375`

### 6. **Remote Browsers**
Configure remote browser instances for synthetic monitoring:
- Add remote browser connections
- WebSocket URL format
- Example: `ws://localhost:8080` (matches your API_PORT)

### 7. **Security**
- **Change Password**:
  - Current password verification
  - New password (minimum 8 characters)
  - Password confirmation
  - Show/hide password toggle
- **Two Factor Authentication**: Coming soon
- **Advanced Security**: Additional features coming soon

### 8. **API Keys**
Complete API key management:
- Generate new API keys with labels
- One-time token display (save it!)
- View creation and last used dates
- Delete unused keys
- Keys are prefixed with `ulk_` for identification

### 9. **Proxies**
Configure HTTP/SOCKS proxies for monitors:
- **Supported Protocols**:
  - HTTP
  - HTTPS
  - SOCKS4
  - SOCKS5
- **Configuration**:
  - Proxy name
  - Host and port
  - Optional authentication (username/password)

### 10. **About**
- Version information
- Frontend version
- GitHub update checks
- Beta release notifications
- Copyright information

## API Endpoints

All settings are stored in the database and accessible via REST API:

### Get All Settings
```
GET /api/settings
Authorization: Bearer {token}
```

### Get Specific Setting
```
GET /api/settings/{key}
Authorization: Bearer {token}
```

### Update Setting
```
PUT /api/settings/{key}
Authorization: Bearer {token}
Content-Type: application/json

{value}
```

### Batch Update Settings
```
POST /api/settings/batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "displayTimezone": "America/New_York",
  "theme": "dark",
  ...
}
```

### Change Password
```
POST /api/settings/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

### API Keys Management
```
GET /api/settings/api-keys
POST /api/settings/api-keys
DELETE /api/settings/api-keys/{id}
```

### Docker Hosts Management
```
GET /api/settings/docker-hosts
POST /api/settings/docker-hosts
DELETE /api/settings/docker-hosts/{id}
```

### Remote Browsers Management
```
GET /api/settings/remote-browsers
POST /api/settings/remote-browsers
DELETE /api/settings/remote-browsers/{id}
```

### Proxies Management
```
GET /api/settings/proxies
POST /api/settings/proxies
DELETE /api/settings/proxies/{id}
```

## Database Schema

Settings are stored in the `Setting` table:
```prisma
model Setting {
  key   String @id
  value Json
}
```

The JSON value allows flexible storage of any setting type:
- Strings
- Numbers
- Booleans
- Objects
- Arrays

## UI Components

New reusable components added:
- **Input**: Styled text input with consistent 46px height
- **Label**: Form label with proper styling

## Notes

- All settings auto-save when you click "Save Settings"
- Password changes require current password verification
- API keys are shown only once when created - save them immediately
- Settings are scoped per installation (single tenant)
- Future enhancement: Multi-user settings with user preferences

## Coming Soon

- Two-factor authentication (2FA)
- Advanced security options
- Global notification defaults
- Monitor history retention settings
- Tag management interface
- More language options
- Custom theme colors
