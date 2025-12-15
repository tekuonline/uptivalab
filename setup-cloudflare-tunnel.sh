#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║           UptivaLab - Cloudflare Tunnel Setup           ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
fi

# Check if CLOUDFLARE_TUNNEL_TOKEN is set
if grep -q "^CLOUDFLARE_TUNNEL_TOKEN=" .env && ! grep -q "^CLOUDFLARE_TUNNEL_TOKEN=$" .env && ! grep -q "^#CLOUDFLARE_TUNNEL_TOKEN=" .env; then
    echo -e "${GREEN}✓ Cloudflare Tunnel token found in .env${NC}"
    TOKEN_SET=true
else
    echo -e "${YELLOW}⚠ Cloudflare Tunnel token not configured${NC}"
    TOKEN_SET=false
fi

if [ "$TOKEN_SET" = false ]; then
    echo ""
    echo -e "${BLUE}To set up Cloudflare Tunnel:${NC}"
    echo ""
    echo "1. Visit: https://one.dash.cloudflare.com/"
    echo "2. Go to: Networks → Tunnels"
    echo "3. Create a tunnel and copy the token"
    echo "4. Run this script again with the token:"
    echo ""
    echo -e "${GREEN}   ./setup-cloudflare-tunnel.sh <your-token>${NC}"
    echo ""
    
    if [ -n "$1" ]; then
        echo -e "${YELLOW}Setting up tunnel with provided token...${NC}"
        
        # Add or update the token in .env
        if grep -q "^#CLOUDFLARE_TUNNEL_TOKEN=" .env; then
            sed -i.bak "s|^#CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=$1|" .env
        elif grep -q "^CLOUDFLARE_TUNNEL_TOKEN=" .env; then
            sed -i.bak "s|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=$1|" .env
        else
            echo "CLOUDFLARE_TUNNEL_TOKEN=$1" >> .env
        fi
        
        rm -f .env.bak
        echo -e "${GREEN}✓ Token added to .env${NC}"
        TOKEN_SET=true
    else
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}Starting UptivaLab with Cloudflare Tunnel...${NC}"
echo ""

# Stop any running containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker compose down 2>/dev/null || true

# Start services (cloudflared runs inside api container if token is set)
echo -e "${YELLOW}Starting all services...${NC}"
docker compose up -d --build

# Wait for services to start
echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

# Check service status
echo ""
echo -e "${BLUE}Service Status:${NC}"
docker compose ps

# Check cloudflared logs from within api container
if [ "$TOKEN_SET" = true ]; then
    echo ""
    echo -e "${BLUE}Cloudflared Connection Status:${NC}"
    docker compose logs api | tail -n 20 | grep -E "cloudflared|Connection|Registered|tunnel|error|ERR" || echo "Checking connection..."
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║              UptivaLab is now running!                   ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Configure public hostname in Cloudflare Dashboard:"
echo "   → https://one.dash.cloudflare.com/"
echo "   → Networks → Tunnels → [Your Tunnel] → Public Hostname"
echo "   → Add: your-subdomain.yourdomain.com → http://web:80"
echo ""
echo "2. Access UptivaLab via your configured domain"
echo ""
echo -e "${YELLOW}Local access (without tunnel):${NC}"
echo "   → http://localhost:4173"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo ""
echo -e "  ${GREEN}View all logs:${NC}          docker compose logs -f"
echo -e "  ${GREEN}View API logs:${NC}          docker compose logs -f api"
echo -e "  ${GREEN}View tunnel logs:${NC}       docker compose logs api | grep cloudflared"
echo -e "  ${GREEN}Stop services:${NC}          docker compose down"
echo -e "  ${GREEN}Restart API:${NC}            docker compose restart api"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  → Full guide: ./CLOUDFLARE_TUNNEL.md"
echo "  → Main README: ./README.md"
echo ""
