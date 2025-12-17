# UptivaLab

<div align="center">

**Beautiful monitoring for the modern homelab** 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-Latest-000000?logo=fastify)](https://fastify.dev/)

</div>

---

## 📖 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Docker Deployment](#-docker-deployment)
- [Configuration](#-configuration)
- [Synthetic Monitoring Guide](#-synthetic-monitoring)
- [Development](#-development)
- [API Documentation](#-api-documentation)
- [License](#-license)

---

## 🌟 Features

UptivaLab is a modern, open-source monitoring application built from the ground up for homelab and power users. It combines the reliability of traditional monitoring tools with a beautiful, responsive interface that rivals modern SaaS products.

### **10 Monitor Types** - All Built-In

| Type | Description | Example |
|------|-------------|---------|
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

### **Beautiful Dashboard**

- 📊 **Real-time graphs** with response time, uptime percentage, and historical trends
- 🎨 **Modern UI** with Tailwind CSS, glassmorphism accents, smooth animations
- 📱 **Responsive design** - perfect on desktop, tablet, and mobile
- 🔄 **Live updates** via WebSocket - no page refresh needed
- 🎯 **Incident timeline** with detailed event history

### **Advanced Capabilities**

- ✅ **Monitor grouping & tags** - organize your infrastructure
- 🔧 **Maintenance windows** - suppress alerts during planned downtime
- 📢 **Multi-channel notifications** - Email (SMTP), ntfy.sh, Discord, Slack, Telegram, Webhooks
- 🌍 **Public status pages** - shareable, no authentication required
- 🔑 **API-first** - full REST API for automation and integrations

---

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Create a directory for UptivaLab:**
   ```bash
   mkdir uptivalab && cd uptivalab
   ```

2. **Download the docker-compose.yml:**
   ```bash
   wget https://raw.githubusercontent.com/tekuonline/uptivalab/main/docker-compose.prod.yml -O docker-compose.yml
   ```

3. **Create environment file:**
   ```bash
   cat > .env <<EOF
   DATABASE_URL=postgresql://uptivalab:uptivalab@postgres:5432/uptivalab
   REDIS_URL=redis://redis:6379
   JWT_SECRET=$(openssl rand -base64 32)
   PORT=8080
   WEB_PORT=4173
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

### Option 1: Using Pre-built Images from Docker Hub (Recommended)

```bash
# Pull the latest images
docker pull curiohokiest2e/uptivalab-api:latest
docker pull curiohokiest2e/uptivalab-web:latest

# Create docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: uptivalab
      POSTGRES_PASSWORD: uptivalab
      POSTGRES_DB: uptivalab
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U uptivalab"]
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

  api:
    image: curiohokiest2e/uptivalab-api:latest
    environment:
      DATABASE_URL: postgresql://uptivalab:uptivalab@postgres:5432/uptivalab
      REDIS_URL: redis://redis:6379
      JWT_SECRET: \${JWT_SECRET}
      PORT: 8080
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  web:
    image: curiohokiest2e/uptivalab-web:latest
    environment:
      VITE_API_URL: http://api:8080
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
EOF

# Create environment file
cat > .env <<EOF
JWT_SECRET=\$(openssl rand -base64 32)
EOF

# Start the services
docker compose up -d
```

### Option 2: With Traefik Reverse Proxy (Advanced)

For production deployments with automatic SSL and load balancing:

```yaml
# docker-compose.yml with Traefik
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: uptivalab
      POSTGRES_PASSWORD: uptivalab
      POSTGRES_DB: uptivalab
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U uptivalab"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - proxy
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - proxy
    restart: unless-stopped

  api:
    image: curiohokiest2e/uptivalab-api:latest
    environment:
      DATABASE_URL: postgresql://uptivalab:uptivalab@postgres:5432/uptivalab
      REDIS_URL: redis://redis:6379
      JWT_SECRET: \${JWT_SECRET}
      PORT: 8080
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.uptivalab-api.rule=Host(\`api.yourdomain.com\`)"
      - "traefik.http.routers.uptivalab-api.entrypoints=websecure"
      - "traefik.http.routers.uptivalab-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.uptivalab-api.loadbalancer.server.port=8080"
      - "traefik.http.routers.uptivalab-api.middlewares=api-stripprefix"
      - "traefik.http.middlewares.api-stripprefix.stripprefix.prefixes=/api"
    networks:
      - proxy
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
    networks:
      - proxy
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
    networks:
      - proxy
    restart: unless-stopped

volumes:
  postgres_data:
  letsencrypt:

networks:
  proxy:
    external: true
```

### Option 3: Building from Source

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

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `REDIS_URL` | Redis connection string | - | ✅ |
| `JWT_SECRET` | Secret for JWT tokens (use strong random string) | - | ✅ |
| `PORT` | API server port | `8080` | ❌ |
| `WEB_PORT` | Web UI port (when not using reverse proxy) | `4173` | ❌ |
| SMTP_HOST | SMTP server hostname | - | ❌ |
| SMTP_PORT | SMTP server port | - | ❌ |
| SMTP_USER | SMTP username | - | ❌ |
| SMTP_PASS | SMTP password | - | ❌ |
| `APPRISE_URL` | Apprise notification server URL | - | ❌ |
| `PLAYWRIGHT_WS_ENDPOINT` | Playwright WebSocket endpoint | `ws://playwright:9222` | ❌ |
| `DOCKER_SOCKET_PATH` | Docker socket path for container monitoring | `/var/run/docker.sock` | ❌ |

### Advanced Configuration

#### Using External PostgreSQL/Redis

For production deployments, consider using managed databases:

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    image: curiohokiest2e/uptivalab-api:latest
    environment:
      DATABASE_URL: postgresql://user:password@your-postgres-host:5432/uptivalab
      REDIS_URL: redis://your-redis-host:6379
      JWT_SECRET: ${JWT_SECRET}
      PORT: 8080
    restart: unless-stopped

  web:
    image: curiohokiest2e/uptivalab-web:latest
    environment:
      VITE_API_URL: https://api.yourdomain.com
    restart: unless-stopped
```

### SMTP Configuration for Notifications

Email notifications are configured per notification channel in the web interface. Environment variables provide global defaults:

```bash
# Optional: Global SMTP defaults (used as fallbacks)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**To configure email notifications:**
1. Go to **Notifications** → **Add Channel**
2. Select **Email (SMTP)**
3. Fill in your SMTP server details
4. Test the configuration
5. Assign monitors to the channel

#### Cloudflare Tunnel Integration

UptivaLab supports Cloudflare Tunnel for secure external access:

1. Install `cloudflared` and authenticate
2. Create a tunnel: `cloudflared tunnel create uptivalab`
3. Configure DNS in Cloudflare dashboard
4. Set tunnel token in UptivaLab settings UI

### Volumes and Persistence

UptivaLab stores all data in PostgreSQL. Make sure to properly backup the `postgres_data` volume:

```bash
# Backup database
docker compose exec postgres pg_dump -U uptivalab uptivalab > backup.sql

# Restore database
docker compose exec -T postgres psql -U uptivalab uptivalab < backup.sql
```

### Monitoring and Logs

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api

# Check container health
docker compose ps
```

### Updating UptivaLab

```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d

# Or rebuild from source
docker compose up -d --build
```

---

## ⚙️ Configuration

### SMTP Email Notifications

SMTP configuration is done **per notification channel** in the UptivaLab web interface. Environment variables serve as global defaults/fallbacks:

**Per-Channel Configuration (Recommended):**
1. Go to **Notifications** in the web interface
2. Create a new **Email (SMTP)** notification channel
3. Configure SMTP settings for that specific channel:
   - SMTP Host (e.g., `smtp.gmail.com`)
   - SMTP Port (e.g., `587` for TLS, `465` for SSL)
   - SMTP Username
   - SMTP Password
   - From Email (optional)

**Global Defaults (Environment Variables):**
Environment variables are used as fallbacks when per-channel settings are not specified:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Push/Heartbeat Monitoring

For cron jobs and scheduled tasks:

1. Create a Push/Heartbeat monitor
2. Copy the heartbeat URL provided
3. Send a POST request from your application:
   ```bash
   curl -X POST https://your-uptivalab.com/api/heartbeat/YOUR_TOKEN
   ```

### Public Status Pages

1. Navigate to "Status Pages" in the UI
2. Create a new status page
3. Add monitors to display
4. Share the public URL (no authentication required)

### Cloudflare Tunnel Integration

UptivaLab includes built-in Cloudflare Tunnel support - **cloudflared runs inside the API container** automatically when you provide a token:

1. **Configure tunnel token in Settings:**
   - Go to **Settings** → **Reverse Proxy** tab
   - Enter your Cloudflare tunnel token
   - Click **Save**

2. **Set up Cloudflare Tunnel:**
   - Create a tunnel at [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
   - Get your tunnel token from the dashboard
   - Add public hostname: `your-subdomain.yourdomain.com` → `http://web:80`

3. **Start UptivaLab:**
   ```bash
   docker compose up -d
   ```

4. **Access externally:**
   - Visit `https://your-subdomain.yourdomain.com`
   - The tunnel will be active once configured

The API container automatically runs both your application and cloudflared using Supervisor. No separate containers or profiles needed!

📖 **[Complete Cloudflare Tunnel Setup Guide](CLOUDFLARE_TUNNEL.md)**

---

## 🎭 Synthetic Monitoring

UptivaLab includes powerful browser-based synthetic monitoring using Playwright. Create multi-step user journeys to test complex workflows like login flows, form submissions, and e-commerce checkouts.

### Features
- ✅ **Multi-step browser automation** - Navigate, click, fill forms, wait for elements
- ✅ **Three browser engines** - Chromium, Firefox, WebKit
- ✅ **Local & remote browsers** - Flexible deployment options
- ✅ **Detailed step results** - See exactly which step failed
- ✅ **Screenshot capture** - Visual debugging
- ✅ **Automatic fallback** - Remote → Local if connection fails

### Quick Example

Create a login flow monitor:
```json
{
  "name": "Login Test",
  "type": "SYNTHETIC",
  "config": {
    "browser": "chromium",
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

### 📖 Complete Guide

For detailed configuration, remote browser setup, troubleshooting, and advanced examples, see:

**[→ Synthetic Monitoring Guide (SYNTHETIC_MONITORING.md)](./SYNTHETIC_MONITORING.md)**

Topics covered:
- Local vs Remote browser comparison
- Setting up the built-in Playwright container
- Configuring remote browsers via UI
- Running standalone Playwright servers
- Step actions reference
- Performance tuning
- Troubleshooting common issues
- Real-world examples

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

# Start database services
docker compose up -d postgres redis

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
cd apps/api
pnpm prisma migrate dev

# Start development servers
# Terminal 1 - API
cd apps/api
pnpm dev

# Terminal 2 - Web
cd apps/web
pnpm dev
```

Visit `http://localhost:5173` for the web UI and `http://localhost:3000` for the API.

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

- **Documentation**: `http://localhost:3000/documentation`
- **API Base URL**: `http://localhost:3000/api`

### Authentication

All API endpoints (except public status pages) require JWT authentication:

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# Use the token
curl http://localhost:3000/api/monitors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 🐛 Support

- **Issues**: [GitHub Issues](https://github.com/tekuonline/uptivalab/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tekuonline/uptivalab/discussions)

---

<div align="center">

**Made with ❤️ for the homelab community**

[⭐ Star on GitHub](https://github.com/tekuonline/uptivalab)

</div>

### **Technology Stack**

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, TanStack Query, Tailwind CSS, Recharts |
| **Backend** | Fastify, TypeScript, Prisma ORM, BullMQ |
| **Database** | PostgreSQL 14+ |
| **Cache/Queue** | Redis 7+ |
| **Real-time** | WebSocket (ws) |
| **Deployment** | Docker, Docker Compose |

---

## 🔧 **Configuration**

### **Environment Variables**

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/uptivalab

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key

# SMTP (optional - for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password

# API Server
PORT=8080
NODE_ENV=production

# Web Server
VITE_API_URL=http://localhost:8080/api
```

### **Docker Compose Services**

The `docker-compose.yml` includes:
- **api** - Fastify backend (port 8080)
- **web** - React frontend (port 4173)
- **postgres** - PostgreSQL database (port 5432)
- **redis** - Redis for job queue (port 6379)

---

## 📊 **API Documentation**

UptivaLab provides a comprehensive REST API for all operations:

### **Authentication**

```bash
# Register
POST /api/auth/register
{
  "email": "admin@example.com",
  "password": "secure-password"
}

# Login
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "secure-password"
}
# Returns: { "token": "jwt-token", "user": {...} }
```

### **Monitors**

```bash
# List all monitors
GET /api/monitors
Authorization: Bearer <token>

# Create monitor
POST /api/monitors
Authorization: Bearer <token>
{
  "name": "My Website",
  "kind": "http",
  "interval": 60000,
  "config": {
    "url": "https://example.com"
  }
}

# Get monitor details
GET /api/monitors/:id

# Update monitor
PUT /api/monitors/:id

# Delete monitor
DELETE /api/monitors/:id

# Get monitor history
GET /api/monitors/:id/history

# Get monitor uptime
GET /api/monitors/:id/uptime
```

### **Status Pages**

```bash
# Create public status page
POST /api/status-pages
{
  "name": "My Services",
  "slug": "my-services",
  "monitorIds": ["monitor-1", "monitor-2"]
}

# Get public status page (no auth required)
GET /api/public/:slug
```

### **Heartbeats**

```bash
# Create heartbeat token
POST /api/heartbeats
{
  "monitorId": "monitor-id",
  "heartbeatSeconds": 300
}

# Ping heartbeat (no auth required)
GET /api/heartbeat/:token
```

---

## 🔔 **Notifications**

### **Supported Channels**

| Channel | Status | Configuration |
|---------|--------|---------------|
| **Email (SMTP)** | ✅ Available | Configure SMTP_* env variables |
| **ntfy.sh** | ✅ Available | Topic name only |
| **Webhook** | ✅ Available | POST URL with JSON payload |
| **Discord** | ✅ Available | Webhook URL |
| **Slack** | ✅ Available | Webhook URL |
| **Telegram** | ✅ Available | Bot token + chat ID |
| **Gotify** | ✅ Available | Server URL + app token |
| **Pushover** | ✅ Available | User key + API token |
| **Apprise** | ✅ Available | Apprise URL syntax |

### **Create Notification Channel**

```bash
POST /api/notifications
{
  "name": "Production Alerts",
  "type": "email",
  "config": {
    "email": "ops@example.com"
  }
}
```

---

## 🐳 **Docker Deployment**

### **With Traefik**

```yaml
services:
  uptivalab-web:
    image: uptivalab/uptivalab:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.uptivalab.rule=Host(`uptime.yourdomain.com`)"
      - "traefik.http.routers.uptivalab.entrypoints=websecure"
      - "traefik.http.routers.uptivalab.tls.certresolver=letsencrypt"
      - "traefik.http.services.uptivalab.loadbalancer.server.port=4173"
```

### **Health Checks**

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

## 🧪 **Testing**

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm coverage

# Run E2E tests
pnpm e2e

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

---

## 🤝 **Contributing**

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### **Development Workflow**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Code of Conduct**

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

---

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎯 **Roadmap**

### **v0.2** (Current)
- ✅ All 10 monitor types
- ✅ Public status pages
- ✅ Incident management
- ✅ Heartbeat monitoring
- ✅ All 9 notification channels (Email, ntfy, Webhook, Discord, Slack, Telegram, Gotify, Pushover, Apprise)

### **v0.3** (Next)
- ✅ Dark/light mode toggle
- ✅ Certificate expiry dashboard widget
- 🔄 Auto-discovery of Docker containers
- 🔄 Settings backup/restore (JSON export)

### **v0.4**
- 🔄 OpenAPI 3.1 spec generation
- 🔄 Comprehensive test coverage (80%+)
- ✅ GitHub Actions CI/CD
- 🔄 Playwright E2E tests

### **v1.0**
- 🔄 Role-based access control
- 🔄 Multi-user support
- 🔄 API keys for automation
- 🔄 Custom domain support for status pages
- 🔄 Advanced alerting rules

---

## 💬 **Community & Support**

- **Documentation**: [docs.uptivalab.dev](https://docs.uptivalab.dev) (Coming Soon)
- **Discord**: [Join our Discord](https://discord.gg/uptivalab) (Coming Soon)
- **GitHub Issues**: [Report bugs or request features](https://github.com/tekuonline/uptivalab/issues)

---

## 🙏 **Acknowledgments**

Inspired by:
- [Uptime Kuma](https://github.com/louislam/uptime-kuma) - The spiritual predecessor
- [Homepage](https://github.com/gethomepage/homepage) - Clean UI design
- [Traefik](https://traefik.io/) - Docker-first deployment approach

---

<div align="center">

**Built with ❤️ for the homelab community**

[⬆ Back to top](#uptivalab)

</div>
