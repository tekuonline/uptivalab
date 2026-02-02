# UptivaLab

<div align="center">

**Beautiful monitoring for the modern homelab**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-Latest-000000?logo=fastify)](https://fastify.dev/)

*Modern, open-source monitoring with a beautiful interface*

[🚀 Quick Start](#-quick-start) • [📖 Documentation](#-documentation) • [🐛 Issues](https://github.com/tekuonline/uptivalab/issues)

</div>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [🐳 Docker Deployment](#-docker-deployment)
- [⚙️ Configuration](#-configuration)
- [🎭 Synthetic Monitoring](#-synthetic-monitoring)
- [🛠️ Development](#-development)
- [📚 API Documentation](#-api-documentation)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)

---

## ✨ Features

UptivaLab is a modern, open-source monitoring application built from the ground up for homelab and power users. It combines the reliability of traditional monitoring tools with a beautiful, responsive interface that rivals modern SaaS products.

### **🔟 Monitor Types - All Built-In**

| Type | Description | Example Use Case |
|------|-------------|------------------|
| 🌐 **HTTP/HTTPS** | Website monitoring with keyword matching, status code validation, custom headers | `https://api.example.com` |
| 🔌 **TCP Port** | Raw TCP connection checks | `10.0.1.100:22` |
| 📡 **Ping (ICMP)** | Network connectivity via ICMP | `8.8.8.8` or `google.com` |
| 🔍 **DNS** | DNS record validation (A, AAAA, MX, TXT, CNAME, NS) | `google.com` |
| 🐳 **Docker** | Container status + image update detection | `my-container` |
| 🔐 **SSL Certificate** | Certificate expiry warnings with custom thresholds | `example.com:443` |
| 🗄️ **Database** | Connection checks for PostgreSQL, MySQL, MariaDB, Redis, MongoDB | `postgres://user:pass@host:5432/db` |
| 🎭 **Synthetic Journey** | Multi-step browser tests with Playwright | Complex user flows |
| ⚡ **gRPC Health** | gRPC health check protocol support | `localhost:50051` |
| 💓 **Push/Heartbeat** | Passive monitoring for cron jobs and scheduled tasks | 300 seconds interval |

### **🎨 Beautiful Dashboard**

- 📊 **Real-time graphs** with response time, uptime percentage, and historical trends
- 🎨 **Modern UI** with Tailwind CSS, glassmorphism accents, smooth animations
- 📱 **Responsive design** - perfect on desktop, tablet, and mobile
- 🔄 **Live updates** via WebSocket - no page refresh needed
- 🎯 **Incident timeline** with detailed event history

### **⚡ Advanced Capabilities**

- ✅ **Monitor grouping & tags** - organize your infrastructure
- 🔧 **Maintenance windows** - suppress alerts during planned downtime
- 📢 **Multi-channel notifications** - Email (SMTP), ntfy.sh, Discord, Slack, Telegram, Gotify, Pushover, Webhooks, Apprise
- 🌍 **Public status pages** - shareable, no authentication required
- 🔑 **API-first** - full REST API for automation and integrations

---

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tekuonline/uptivalab.git
   cd uptivalab
   ```

2. **Copy the production docker-compose file:**
   ```bash
   cp docker-compose.prod.yml docker-compose.yml
   ```

3. **Create environment file:**
   ```bash
   cat > .env <<EOF
   # Database Configuration
   POSTGRES_USER=uptivalab
   POSTGRES_PASSWORD=uptivalab
   POSTGRES_DB=uptivalab

   # Security
   JWT_SECRET=\$(openssl rand -base64 32)

   # Ports
   API_PORT=8080
   WEB_PORT=4173

   # Docker Hub Version
   VERSION=latest

   # Web Service Configuration
   VITE_API_URL=http://api:8080
   API_UPSTREAM=http://api:8080

   # Optional: SMTP Email Configuration
   # SMTP_HOST=smtp.gmail.com
   # SMTP_PORT=587
   # SMTP_USER=your-email@gmail.com
   # SMTP_PASS=super-secret
   EOF
   ```

4. **Start the services:**
   ```bash
   docker compose up -d
   ```

5. **Access UptivaLab:**
   - Open your browser to `http://localhost:4173`
   - Create your admin account on first visit

---

## 🐳 Docker Deployment

UptivaLab provides pre-built Docker images for easy deployment. The recommended approach is using the provided `docker-compose.prod.yml` file.

### Pre-built Images (Recommended)

```bash
# Pull the latest images
docker pull curiohokiest2e/uptivalab-api:latest
docker pull curiohokiest2e/uptivalab-web:latest

# Use the provided docker-compose.prod.yml
cp docker-compose.prod.yml docker-compose.yml

# Create environment file (see Quick Start above)
cat > .env <<EOF
# Database Configuration
POSTGRES_USER=uptivalab
POSTGRES_PASSWORD=uptivalab
POSTGRES_DB=uptivalab

# Security
JWT_SECRET=\$(openssl rand -base64 32)

# Ports
API_PORT=8080
WEB_PORT=4173

# Docker Hub Version
VERSION=latest

# Web Service Configuration
VITE_API_URL=http://api:8080
API_UPSTREAM=http://api:8080
EOF

# Start the services
docker compose up -d

# Access your application:
# - Web UI: http://localhost:4173
# - API: http://localhost:8080
```

### Manual Docker Compose Setup

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-uptivalab}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-uptivalab}
      POSTGRES_DB: ${POSTGRES_DB:-uptivalab}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-uptivalab}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  playwright:
    image: mcr.microsoft.com/playwright:v1.57.0-jammy
    command: ["npx", "playwright", "run-server", "--port", "9222"]
    environment:
      - PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
    shm_size: 2gb
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9222/"]
      interval: 30s
      timeout: 10s
      retries: 3

  api:
    image: curiohokiest2e/uptivalab-api:${VERSION:-latest}
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-uptivalab}:${POSTGRES_PASSWORD:-uptivalab}@postgres:5432/${POSTGRES_DB:-uptivalab}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      PORT: 8080
      NODE_ENV: production
      PLAYWRIGHT_WS_ENDPOINT: ws://playwright:9222/
      # Optional SMTP configuration
      SMTP_HOST: ${SMTP_HOST:-}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER:-}
      SMTP_PASS: ${SMTP_PASS:-}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      playwright:
        condition: service_healthy
    restart: unless-stopped

  web:
    image: curiohokiest2e/uptivalab-web:${VERSION:-latest}
    environment:
      VITE_API_URL: ${VITE_API_URL:-http://api:8080}
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
```

### With Traefik Reverse Proxy (Production)

For production deployments with automatic SSL:

```yaml
# docker-compose.prod.yml with Traefik
version: '3.8'

services:
  # ... postgres, redis, playwright services (same as above)

  api:
    image: curiohokiest2e/uptivalab-api:latest
    environment:
      DATABASE_URL: postgresql://uptivalab:uptivalab@postgres:5432/uptivalab
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      PORT: 8080
      NODE_ENV: production
      PLAYWRIGHT_WS_ENDPOINT: ws://playwright:9222/
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.uptivalab-api.rule=Host(\`api.yourdomain.com\`)"
      - "traefik.http.routers.uptivalab-api.entrypoints=websecure"
      - "traefik.http.routers.uptivalab-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.uptivalab-api.loadbalancer.server.port=8080"
      - "traefik.http.middlewares.api-stripprefix.stripprefix.prefixes=/api"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      playwright:
        condition: service_healthy
    restart: unless-stopped

  web:
    image: curiohokiest2e/uptivalab-web:latest
    environment:
      VITE_API_URL: https://api.yourdomain.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.uptivalab-web.rule=Host(\`uptivalab.yourdomain.com\`)"
      - "traefik.http.routers.uptivalab-web.entrypoints=websecure"
      - "traefik.http.routers.uptivalab-web.tls.certresolver=letsencrypt"
      - "traefik.http.services.uptivalab-web.loadbalancer.server.port=80"
    depends_on:
      - api
    restart: unless-stopped

  traefik:
    image: traefik:v3.0
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    restart: unless-stopped

volumes:
  postgres_data:
  letsencrypt:
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/tekuonline/uptivalab.git
cd uptivalab

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Build and start
docker compose up -d --build
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` | ✅ |
| `JWT_SECRET` | Secret for JWT tokens (use strong random string) | - | ✅ |
| `PORT` | API server port | `8080` | ❌ |
| `WEB_PORT` | Web UI port (when not using reverse proxy) | `4173` | ❌ |
| `VITE_API_URL` | External API endpoint for frontend | `http://api:8080` | ❌ |
| `API_UPSTREAM` | Internal API address for nginx proxy | `http://api:8080` | ❌ |
| `SMTP_HOST` | SMTP server hostname | - | ❌ |
| `SMTP_PORT` | SMTP server port | `587` | ❌ |
| `SMTP_USER` | SMTP username | - | ❌ |
| `SMTP_PASS` | SMTP password | - | ❌ |
| `PLAYWRIGHT_WS_ENDPOINT` | Playwright WebSocket endpoint | `ws://playwright:9222` | ❌ |

### WebSocket Configuration

UptivaLab uses WebSocket connections for real-time updates:

- **Endpoint**: `wss://your-domain.com/ws/stream`
- **Authentication**: JWT token as query parameter (`?token=your-jwt-token`)
- **Features**: Real-time monitor results and incident updates

### SMTP Email Notifications

Configure SMTP per notification channel in the web interface:

1. Go to **Notifications** → **Add Channel**
2. Select **Email (SMTP)**
3. Configure SMTP settings:
   - Host (e.g., `smtp.gmail.com`)
   - Port (e.g., `587` for TLS)
   - Username & Password
   - From Email

### Cloudflare Tunnel Integration

1. Install `cloudflared` and authenticate
2. Create a tunnel: `cloudflared tunnel create uptivalab`
3. Configure DNS in Cloudflare dashboard
4. Set tunnel token in UptivaLab settings UI

The API container automatically runs both your application and cloudflared.

---

## 🎭 Synthetic Monitoring

UptivaLab includes powerful browser-based synthetic monitoring using Playwright with **embedded browsers running directly in the API container**.

### Features
- ✅ **Multi-step browser automation** - Navigate, click, fill forms, wait for elements
- ✅ **Three browser engines** - Chromium, Firefox, WebKit
- ✅ **Embedded browsers (default)** - No separate browser service needed
- ✅ **Remote browser option** - For advanced isolation scenarios
- ✅ **Detailed step results** - See exactly which step failed
- ✅ **Screenshot capture** - Visual debugging

### Quick Example

```json
{
  "name": "Login Test",
  "type": "SYNTHETIC",
  "config": {
    "browser": "chromium",
    "useLocalBrowser": true,
    "steps": [
      {"action": "goto", "url": "https://example.com/login"},
      {"action": "fill", "selector": "#email", "value": "test@example.com"},
      {"action": "fill", "selector": "#password", "value": "secret"},
      {"action": "click", "selector": "button[type=submit]"},
      {"action": "waitForSelector", "selector": ".dashboard"}
    ]
  }
}
```

📖 **[Complete Synthetic Monitoring Guide](./SYNTHETIC_MONITORING.md)**  
🚀 **[Embedded Browser Enhancement Details](./SYNTHETIC_BROWSER_ENHANCEMENT.md)**

---

## 🛠️ Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/tekuonline/uptivalab.git
cd uptivalab

# Install dependencies
pnpm install

# Start database services (playwright service is now optional)
docker compose up -d postgres redis

# Optional: Start remote Playwright service (only if needed)
# docker compose --profile remote-browser up -d playwright

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
cd apps/api
pnpm prisma migrate dev

# Start development servers
pnpm dev
```

Visit `http://localhost:5173` for the web UI and `http://localhost:8080` for the API.

### Project Structure

```
uptivalab/
├── apps/
│   ├── api/          # Fastify backend
│   └── web/          # React frontend
├── packages/
│   ├── shared/       # Shared types and schemas
│   └── monitoring/   # Monitoring engine
├── docker-compose.yml
└── README.md
```

---

## 📚 API Documentation

The API is fully documented with OpenAPI/Swagger.

- **Documentation**: `http://localhost:8080/documentation`
- **API Base URL**: `http://localhost:8080/api`

### Authentication

UptivaLab supports two authentication methods:

#### JWT Authentication (Recommended for interactive use)
All API endpoints require JWT authentication. Include the token in the Authorization header:

```bash
# Login to get JWT token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# Use the token
curl http://localhost:8080/api/monitors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### API Key Authentication (Recommended for automation)
API keys provide secure, long-lived authentication for automated systems and integrations:

```bash
# Create an API key (requires JWT authentication)
curl -X POST http://localhost:8080/api/auth/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label": "My Integration"}'

# Use the API key
curl http://localhost:8080/api/status \
  -H "X-API-Key: ulk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Or in Authorization header
curl http://localhost:8080/api/status \
  -H "Authorization: Bearer ulk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

API keys are prefixed with `ulk_` and provide the same access as the user who created them.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🐛 Support

- **Issues**: [GitHub Issues](https://github.com/tekuonline/uptivalab/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tekuonline/uptivalab/discussions)

---

<div align="center">

**Made with ❤️ for the homelab community**

[⭐ Star on GitHub](https://github.com/tekuonline/uptivalab) • [⬆ Back to top](#uptivalab)

</div>

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, TanStack Query, Tailwind CSS, Recharts |
| **Backend** | Fastify, TypeScript, Prisma ORM, BullMQ |
| **Database** | PostgreSQL 16+ |
| **Cache/Queue** | Redis 7+ |
| **Real-time** | WebSocket |
| **Deployment** | Docker, Docker Compose |

---

## 📊 API Reference

### Monitors

```bash
# List monitors
GET /api/monitors

# Create monitor
POST /api/monitors
{
  "name": "My Website",
  "kind": "http",
  "interval": 60000,
  "config": { "url": "https://example.com" }
}

# Update monitor
PUT /api/monitors/:id

# Delete monitor
DELETE /api/monitors/:id
```

### Notifications

```bash
# Create notification channel
POST /api/notifications
{
  "name": "Production Alerts",
  "type": "email",
  "config": { "email": "ops@example.com" }
}
```

### Status Pages

```bash
# Create public status page
POST /api/status-pages
{
  "name": "My Services",
  "slug": "my-services",
  "monitorIds": ["monitor-1", "monitor-2"]
}
```

---

## 🔔 Notification Channels

| Channel | Status | Configuration |
|---------|--------|---------------|
| **Email (SMTP)** | ✅ | SMTP server settings |
| **ntfy.sh** | ✅ | Topic name |
| **Discord** | ✅ | Webhook URL |
| **Slack** | ✅ | Webhook URL |
| **Telegram** | ✅ | Bot token + chat ID |
| **Gotify** | ✅ | Server URL + app token |
| **Pushover** | ✅ | User key + API token |
| **Webhook** | ✅ | POST URL with JSON payload |
| **Apprise** | ✅ | Apprise URL syntax |

---

## 🔄 Updating UptivaLab

```bash
# Pull latest images
docker compose pull

# Restart services
docker compose up -d

# Or rebuild from source
docker compose up -d --build
```

---

## 💾 Backup & Restore

```bash
# Backup database
docker compose exec postgres pg_dump -U uptivalab uptivalab > backup.sql

# Restore database
docker compose exec -T postgres psql -U uptivalab uptivalab < backup.sql
```

---

## 📈 Monitoring & Logs

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api

# Check container health
docker compose ps
```

---

## 🔧 Troubleshooting

### Common Issues

#### ESLint Compatibility Issues
**Issue**: ESLint 9.0.0 with eslint-plugin-react-hooks v4.6.0 compatibility
**Solution**: The react-hooks plugin rules are temporarily disabled in the ESLint configuration. They will be re-enabled when the plugin is updated for ESLint 9 compatibility.

#### Database Connection Errors
**Issue**: `Connection refused` or `ECONNREFUSED` when connecting to PostgreSQL
**Solution**: 
- Ensure PostgreSQL container is running: `docker compose ps`
- Check database credentials in `.env` file
- Wait for database to be ready: `docker compose logs postgres | grep "ready to accept connections"`

#### Playwright Browser Installation
**Issue**: Synthetic monitoring tests fail with browser not found
**Solution**: 
- API container has embedded Playwright browsers by default
- If using remote browser: `docker compose --profile remote-browser up -d playwright`
- Check browser installation logs: `docker compose logs api | grep playwright`

#### Port Already in Use
**Issue**: `Error: listen EADDRINUSE: address already in use :::4173`
**Solution**:
- Change ports in `.env` file:
  ```bash
  WEB_PORT=4174
  API_PORT=8081
  ```
- Or stop the conflicting process: `lsof -ti:4173 | xargs kill -9`

#### Memory Issues with Redis
**Issue**: Redis crashes or becomes unresponsive
**Solution**: 
- Increase Docker memory allocation (minimum 2GB recommended)
- Monitor Redis memory: `docker compose exec redis redis-cli INFO memory`

---

<div align="center">

**Built with ❤️ for the homelab community**

[⬆ Back to top](#uptivalab)

</div>
