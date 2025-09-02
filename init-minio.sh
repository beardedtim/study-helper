#!/bin/sh
set -euo pipefail

wait_for_minio() {
  until mc ready myminio > /dev/null 2>&1; do
    echo "Waiting for MinIO to be ready..."
    sleep 2
  done
}

mc alias set myminio http://files:9000 minioadmin minioadmin

wait_for_minio

# Create bucket if it doesn't exist
mc mb myminio/ingest --ignore-existing || true

# Add event notification (target already defined by env vars)
mc event add myminio/ingest arn:minio:sqs::PRIMARY:amqp --event put --ignore-existing || true

echo "✅ MinIO initialization complete"
