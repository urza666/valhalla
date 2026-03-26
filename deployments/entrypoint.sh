#!/bin/sh
set -e

echo "══════════════════════════════════════"
echo "  Valhalla API Server"
echo "══════════════════════════════════════"

# docker-compose depends_on with healthcheck ensures PG is ready,
# but add a small buffer for the TCP listener to stabilize
echo "Waiting for database..."
sleep 5

# Run database migrations
echo "Running database migrations..."
./valhalla-migrate -direction up 2>&1 || echo "Migrations: no changes or already up-to-date."

# Start the requested binary (default: valhalla-api)
BINARY="${1:-./valhalla-api}"
echo "Starting ${BINARY}..."
exec ${BINARY}
