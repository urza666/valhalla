#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Valhalla — One-Command Setup
# ═══════════════════════════════════════════════════════════
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║         Valhalla — Setup                     ║"
echo "║   Open Source Communication Platform         ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check prerequisites ───────────────────────────────────
check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        echo -e "${YELLOW}Error: $1 is required but not installed.${NC}"
        exit 1
    fi
}

check_cmd docker
echo -e "${GREEN}✓${NC} Docker found"

if docker compose version &>/dev/null; then
    COMPOSE="docker compose"
elif docker-compose version &>/dev/null; then
    COMPOSE="docker-compose"
else
    echo -e "${YELLOW}Error: docker compose is required.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker Compose found"

# ── Create .env if missing ────────────────────────────────
if [ ! -f .env ]; then
    echo ""
    echo -e "${CYAN}Creating .env from template...${NC}"
    cp .env.example .env

    # Auto-generate secure secrets for production
    if command -v openssl &>/dev/null; then
        TOKEN_SECRET=$(openssl rand -hex 32)
        DB_PASS=$(openssl rand -hex 16)
        REDIS_PASS=$(openssl rand -hex 16)
        MEILI_KEY=$(openssl rand -hex 16)
        LK_KEY=$(openssl rand -hex 8)
        LK_SECRET=$(openssl rand -hex 16)
        MINIO_KEY=$(openssl rand -hex 8)
        MINIO_SECRET=$(openssl rand -hex 16)

        # Replace default values with generated secrets
        sed -i "s/TOKEN_SECRET=change-me-to-a-random-64-char-string-in-production/TOKEN_SECRET=${TOKEN_SECRET}/" .env
        sed -i "s/DB_PASSWORD=valhalla/DB_PASSWORD=${DB_PASS}/" .env
        sed -i "s/REDIS_PASSWORD=valhalla/REDIS_PASSWORD=${REDIS_PASS}/" .env
        sed -i "s/MEILI_API_KEY=valhalla-dev-key/MEILI_API_KEY=${MEILI_KEY}/" .env
        sed -i "s/LIVEKIT_API_KEY=devkey/LIVEKIT_API_KEY=${LK_KEY}/" .env
        sed -i "s/LIVEKIT_API_SECRET=devsecret/LIVEKIT_API_SECRET=${LK_SECRET}/" .env
        sed -i "s/STORAGE_ACCESS_KEY=minioadmin/STORAGE_ACCESS_KEY=${MINIO_KEY}/" .env
        sed -i "s/STORAGE_SECRET_KEY=minioadmin/STORAGE_SECRET_KEY=${MINIO_SECRET}/" .env

        echo -e "${GREEN}✓${NC} Generated secure random secrets"
    else
        echo -e "${YELLOW}⚠${NC} openssl not found — using default secrets. Change them for production!"
    fi
else
    echo -e "${GREEN}✓${NC} .env already exists"
fi

# ── Build and start ───────────────────────────────────────
echo ""
echo -e "${CYAN}Building containers...${NC}"
$COMPOSE build --quiet

echo ""
echo -e "${CYAN}Starting services...${NC}"
$COMPOSE up -d

# ── Wait for health ───────────────────────────────────────
echo ""
echo -e "${CYAN}Waiting for services to become healthy...${NC}"

wait_for_service() {
    local service=$1
    local max_wait=$2
    local elapsed=0
    while [ $elapsed -lt $max_wait ]; do
        status=$($COMPOSE ps --format json "$service" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('Health',''))" 2>/dev/null || echo "")
        if [ "$status" = "healthy" ]; then
            echo -e "  ${GREEN}✓${NC} $service"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    echo -e "  ${YELLOW}⚠${NC} $service (timeout — may still be starting)"
    return 0
}

wait_for_service postgres 30
wait_for_service redis 15
wait_for_service api 45
wait_for_service web 30

# ── Done ──────────────────────────────────────────────────
WEB_PORT=$(grep "^WEB_PORT=" .env 2>/dev/null | cut -d= -f2 || echo "80")
API_PORT=$(grep "^API_PORT=" .env 2>/dev/null | cut -d= -f2 || echo "8080")

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════╗"
echo "║         Valhalla is running!                 ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  Web App:    http://localhost:${WEB_PORT:-80}             ║"
echo "║  API:        http://localhost:${API_PORT:-8080}/api/v1      ║"
echo "║  WebSocket:  ws://localhost:${API_PORT:-8080}/ws            ║"
echo "║  MinIO:      http://localhost:9001           ║"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Commands:"
echo "  docker compose logs -f        # View logs"
echo "  docker compose ps             # Service status"
echo "  docker compose down           # Stop all"
echo "  docker compose down -v        # Stop + delete data"
echo ""
