#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Valhalla — PostgreSQL Backup Script
# Run via cron: 0 2 * * * /opt/valhalla/deployments/backup/backup.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_HOST="${DB_HOST:-postgres}"
DB_USER="${DB_USER:-valhalla}"
DB_NAME="${DB_NAME:-valhalla}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/valhalla_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup..."

# Dump database (compressed)
PGPASSWORD="${DB_PASSWORD:-valhalla}" pg_dump \
  -h "${DB_HOST}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip > "${BACKUP_FILE}"

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup created: ${BACKUP_FILE} (${FILESIZE})"

# Cleanup old backups (keep last RETENTION_DAYS days)
find "${BACKUP_DIR}" -name "valhalla_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
REMAINING=$(ls -1 "${BACKUP_DIR}"/valhalla_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Cleanup done. ${REMAINING} backups retained."

echo "[$(date)] Backup complete."
