#!/bin/bash
# Backup MongoDB data on DigitalOcean
# Run daily via cron: 0 2 * * * /path/to/backup-mongodb.sh

set -e

BACKUP_DIR="/backups/mongodb"
MONGODB_DATA_PATH="${MONGODB_DATA_PATH:-/mnt/otl_staffing_data}"
MONGODB_HOST="${MONGODB_HOST:-mongodb}"
MONGO_ROOT_USER="${MONGO_ROOT_USER:-mongoadmin}"
MONGO_ROOT_PASSWORD="${MONGO_ROOT_PASSWORD}"
RETENTION_DAYS=${RETENTION_DAYS:-7}
BACKUP_NAME="otl_staffing_$(date +%Y%m%d_%H%M%S)"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$BACKUP_DIR/backup.log"
}

log "Starting MongoDB backup..."

# Method 1: mongodump (if mongodump is available in container)
# This is safer and more portable
DUMP_DIR="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$DUMP_DIR"

# Run mongodump from app container or via docker exec
if command -v mongodump &> /dev/null; then
  mongodump \
    --uri="mongodb://$MONGO_ROOT_USER:$MONGO_ROOT_PASSWORD@$MONGODB_HOST:27017/otl_staffing?authSource=admin" \
    --out="$DUMP_DIR" \
    --archive="$DUMP_DIR/otl_staffing.archive" \
    2>&1 | tee -a "$BACKUP_DIR/backup.log"

  # Remove uncompressed dump if archive exists
  rm -rf "$DUMP_DIR"/otl_staffing

  log "✅ Backup completed: $DUMP_DIR/otl_staffing.archive"
else
  # Fallback: Compress the data directory (if you have access)
  tar -czf "$DUMP_DIR/mongodb_data.tar.gz" "$MONGODB_DATA_PATH" 2>&1 | tee -a "$BACKUP_DIR/backup.log"
  log "✅ Data directory backup completed: $DUMP_DIR/mongodb_data.tar.gz"
fi

# Upload to DigitalOcean Spaces (optional)
if command -v aws &> /dev/null; then
  log "Uploading to DigitalOcean Spaces..."
  aws s3 cp "$DUMP_DIR" \
    "s3://${DO_SPACES_BUCKET}/mongodb-backups/$BACKUP_NAME/" \
    --recursive \
    --endpoint-url "https://${DO_SPACES_REGION}.digitaloceanspaces.com" \
    --region "${DO_SPACES_REGION}" 2>&1 | tee -a "$BACKUP_DIR/backup.log"
  log "✅ Uploaded to Spaces"
fi

# Cleanup old backups (keep last 7 days)
log "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -maxdepth 1 -type d -name "otl_staffing_*" -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true

log "✅ Backup process completed successfully"
log "Backup location: $DUMP_DIR"
