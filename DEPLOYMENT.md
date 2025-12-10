# UptivaLab Deployment Guide

This guide covers deploying UptivaLab using Docker images from Docker Hub.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 1GB+ RAM
- 10GB+ disk space

## Quick Deployment

### Step 1: Create Deployment Directory

```bash
mkdir -p ~/uptivalab && cd ~/uptivalab
```

### Step 2: Download Docker Compose File

```bash
wget https://raw.githubusercontent.com/YOUR_USERNAME/uptivalab/main/docker-compose.prod.yml -O docker-compose.yml
```

Or create it manually with the configuration below.

### Step 3: Create Environment File

```bash
cat > .env <<EOF
# Database Configuration
POSTGRES_USER=uptivalab
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=uptivalab

# Security
JWT_SECRET=$(openssl rand -base64 64)

# Ports
API_PORT=3000
WEB_PORT=4173

# Docker Hub
DOCKER_USERNAME=YOUR_DOCKERHUB_USERNAME
VERSION=latest

# Optional: SMTP Email Configuration
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
EOF
```

**Important**: Replace `YOUR_DOCKERHUB_USERNAME` with the actual Docker Hub username.

### Step 4: Start Services

```bash
docker compose up -d
```

### Step 5: Verify Deployment

```bash
# Check if all services are running
docker compose ps

# View logs
docker compose logs -f

# Check API health
curl http://localhost:3000/health

# Access the web UI
open http://localhost:4173
```

## Production Deployment

### Using Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/uptivalab`:

```nginx
server {
    listen 80;
    server_name monitor.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name monitor.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/monitor.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitor.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Web UI
    location / {
        proxy_pass http://localhost:4173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for real-time updates
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/uptivalab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Using Traefik

Add labels to your `docker-compose.yml`:

```yaml
services:
  web:
    image: ${DOCKER_USERNAME}/uptivalab-web:${VERSION:-latest}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.uptivalab-web.rule=Host(`monitor.yourdomain.com`)"
      - "traefik.http.routers.uptivalab-web.entrypoints=websecure"
      - "traefik.http.routers.uptivalab-web.tls.certresolver=letsencrypt"
      - "traefik.http.services.uptivalab-web.loadbalancer.server.port=80"
    networks:
      - traefik
      - uptivalab

  api:
    image: ${DOCKER_USERNAME}/uptivalab-api:${VERSION:-latest}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.uptivalab-api.rule=Host(`monitor.yourdomain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.uptivalab-api.entrypoints=websecure"
      - "traefik.http.routers.uptivalab-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.uptivalab-api.loadbalancer.server.port=3000"
    networks:
      - traefik
      - uptivalab

networks:
  traefik:
    external: true
  uptivalab:
    driver: bridge
```

## Backup and Restore

### Backup

```bash
# Backup PostgreSQL database
docker compose exec postgres pg_dump -U uptivalab uptivalab | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup environment file
cp .env .env.backup
```

### Restore

```bash
# Restore PostgreSQL database
gunzip < backup-20240101-120000.sql.gz | docker compose exec -T postgres psql -U uptivalab uptivalab
```

### Automated Backups

Create `/etc/cron.daily/uptivalab-backup`:

```bash
#!/bin/bash
cd ~/uptivalab
docker compose exec postgres pg_dump -U uptivalab uptivalab | gzip > /backups/uptivalab-$(date +%Y%m%d).sql.gz

# Keep only last 30 days
find /backups -name "uptivalab-*.sql.gz" -mtime +30 -delete
```

Make it executable:
```bash
sudo chmod +x /etc/cron.daily/uptivalab-backup
```

## Updating

### Update to Latest Version

```bash
cd ~/uptivalab

# Pull latest images
docker compose pull

# Restart services
docker compose up -d

# Clean up old images
docker image prune -f
```

### Update to Specific Version

```bash
# Edit .env and change VERSION
VERSION=v1.2.3

# Pull and restart
docker compose pull
docker compose up -d
```

## Monitoring and Logs

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web

# Last 100 lines
docker compose logs --tail=100
```

### Check Resource Usage

```bash
docker stats
```

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Database connection
docker compose exec postgres pg_isready -U uptivalab

# Redis connection
docker compose exec redis redis-cli ping
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose logs

# Check if ports are already in use
sudo lsof -i :3000
sudo lsof -i :4173
sudo lsof -i :5432
```

### Database Issues

```bash
# Reset database (WARNING: Destroys all data)
docker compose down -v
docker compose up -d

# Connect to database
docker compose exec postgres psql -U uptivalab
```

### Permission Issues

```bash
# Fix volume permissions
docker compose down
sudo chown -R $(id -u):$(id -g) ./volumes/
docker compose up -d
```

## Security Best Practices

1. **Change Default Passwords**: Always use strong, random passwords
2. **Use HTTPS**: Deploy behind a reverse proxy with SSL/TLS
3. **Firewall**: Only expose necessary ports (80, 443)
4. **Regular Updates**: Keep Docker images up to date
5. **Backups**: Implement automated backups
6. **Network Isolation**: Use Docker networks to isolate services
7. **Secrets Management**: Never commit `.env` to version control

## Performance Tuning

### PostgreSQL

Add to `docker-compose.yml` under postgres service:

```yaml
postgres:
  command: 
    - "postgres"
    - "-c"
    - "shared_buffers=256MB"
    - "-c"
    - "max_connections=200"
    - "-c"
    - "work_mem=16MB"
```

### Redis

```yaml
redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

## Support

- **Documentation**: https://github.com/YOUR_USERNAME/uptivalab
- **Issues**: https://github.com/YOUR_USERNAME/uptivalab/issues
- **Discussions**: https://github.com/YOUR_USERNAME/uptivalab/discussions
