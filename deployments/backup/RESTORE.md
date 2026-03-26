# Valhalla — Database Restore Runbook

## Prerequisites
- Docker Compose running
- Backup file (`.sql.gz`)

## Restore Steps

### 1. Stop the API (prevent writes during restore)
```bash
docker compose stop api
```

### 2. Identify the backup to restore
```bash
ls -la /backups/valhalla_*.sql.gz
# or: docker compose exec postgres ls /backups/
```

### 3. Restore the backup
```bash
# Drop and recreate the database
docker compose exec -T postgres psql -U valhalla -d postgres -c "DROP DATABASE IF EXISTS valhalla;"
docker compose exec -T postgres psql -U valhalla -d postgres -c "CREATE DATABASE valhalla OWNER valhalla;"

# Restore from backup
gunzip -c /backups/valhalla_20260326_020000.sql.gz | \
  docker compose exec -T postgres psql -U valhalla -d valhalla
```

### 4. Verify the restore
```bash
docker compose exec -T postgres psql -U valhalla -d valhalla -c "\dt" | wc -l
# Should show ~44 tables
```

### 5. Restart the API
```bash
docker compose start api
```

### 6. Verify the application
```bash
curl http://localhost:3081/health
# Should return {"status":"healthy",...}
```

## Automated Backups

Backups run daily at 2:00 AM via cron:
```
0 2 * * * /opt/valhalla/deployments/backup/backup.sh >> /var/log/valhalla-backup.log 2>&1
```

Retention: 14 days (configurable via `RETENTION_DAYS` env var).

## Emergency: Point-in-Time Recovery

For point-in-time recovery, enable WAL archiving in PostgreSQL:
```yaml
# docker-compose.yml postgres command:
command: >
  -c wal_level=replica
  -c archive_mode=on
  -c archive_command='cp %p /backups/wal/%f'
```

This is recommended for production but not enabled by default.
