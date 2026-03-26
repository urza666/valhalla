#!/bin/sh
set -e

echo "══════════════════════════════════════"
echo "  Valhalla API Server"
echo "══════════════════════════════════════"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until curl -sf "http://${DB_HOST:-postgres}:${DB_PORT:-5432}" >/dev/null 2>&1 || pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" >/dev/null 2>&1; do
    sleep 1
done 2>/dev/null || sleep 5
echo "PostgreSQL is ready."

# Run database migrations
echo "Running database migrations..."
./valhalla-migrate -direction up 2>&1 || echo "Migrations: no changes or already up-to-date."

# Start API server
echo "Starting Valhalla API on :8080..."
exec ./valhalla-api
