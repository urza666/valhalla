#!/bin/sh
set -e

echo "Running database migrations..."
./valhalla-migrate -direction up || true

echo "Starting Valhalla API server..."
exec ./valhalla-api
