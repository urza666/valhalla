#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════╗"
echo "║          Valhalla Self-Hosted Setup           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Error: docker is required"; exit 1; }
command -v docker compose >/dev/null 2>&1 || { echo "Error: docker compose is required"; exit 1; }

cd "$(dirname "$0")"

# Generate .env if not exists
if [ ! -f .env ]; then
    echo "Generating .env from template..."
    cp .env.example .env

    # Auto-generate secrets
    TOKEN_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)
    REDIS_PASSWORD=$(openssl rand -hex 16)
    LIVEKIT_KEY=$(openssl rand -hex 8)
    LIVEKIT_SECRET=$(openssl rand -hex 16)
    MINIO_ACCESS=$(openssl rand -hex 8)
    MINIO_SECRET=$(openssl rand -hex 16)
    MEILI_KEY=$(openssl rand -hex 16)

    sed -i "s/CHANGE_ME_STRONG_PASSWORD/$DB_PASSWORD/g" .env
    sed -i "s/CHANGE_ME_REDIS_PASSWORD/$REDIS_PASSWORD/g" .env
    sed -i "s/CHANGE_ME_GENERATE_WITH_OPENSSL_RAND_HEX_32/$TOKEN_SECRET/g" .env
    sed -i "s/CHANGE_ME_LIVEKIT_KEY/$LIVEKIT_KEY/g" .env
    sed -i "s/CHANGE_ME_LIVEKIT_SECRET/$LIVEKIT_SECRET/g" .env
    sed -i "s/CHANGE_ME_MINIO_ACCESS/$MINIO_ACCESS/g" .env
    sed -i "s/CHANGE_ME_MINIO_SECRET/$MINIO_SECRET/g" .env
    sed -i "s/CHANGE_ME_MEILI_KEY/$MEILI_KEY/g" .env

    echo "Generated .env with random secrets."
    echo ""
    echo "IMPORTANT: Edit .env and set DOMAIN to your domain name."
    echo ""
fi

read -p "Set your domain (or press Enter for localhost): " DOMAIN
if [ -n "$DOMAIN" ]; then
    sed -i "s/DOMAIN=.*/DOMAIN=$DOMAIN/" .env
fi

echo ""
echo "Starting Valhalla..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║          Valhalla is running!                 ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Web:   https://${DOMAIN:-localhost}          ║"
echo "║  API:   https://${DOMAIN:-localhost}/api/v1   ║"
echo "║  WS:    wss://${DOMAIN:-localhost}/ws          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Logs: docker compose -f docker-compose.prod.yml logs -f"
echo "Stop: docker compose -f docker-compose.prod.yml down"
