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

# Add or update RabbitMQ (AMQP) notification target
mc admin config set myminio notify_amqp:rabbit \
  url="amqp://guest:guest@messages:5672/" \
  exchange="minio.events" \
  exchange_type="fanout" \
  routing_key="minio.ingest" \
  delivery_mode="0" \
  mandatory="off" \
  durable="on" \
  no_wait="off" \
  internal="off" \
  auto_deleted="off" \
  --json

# Add event notification for the bucket using the rabbit target
mc event add myminio/ingest arn:minio:sqs::PRIMARY:amqp --event put --ignore-existing || true

echo