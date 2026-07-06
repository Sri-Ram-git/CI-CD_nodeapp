#!/bin/sh
set -e

DOCKER_IMAGE="${DOCKER_IMAGE:-mrsridoc/node-ci-app}"
PREVIOUS_TAG="${PREVIOUS_TAG:-latest}"
CONTAINER_NAME="ci-cd-nodeapp"
PORT="${PORT:-3000}"
MAX_RETRIES=5
RETRY_DELAY=5
WEBHOOK_URL="${WEBHOOK_URL:-}"

echo "=== ROLLBACK TRIGGERED ==="
echo "Rolling back $DOCKER_IMAGE to tag: $PREVIOUS_TAG"

echo "Pulling previous image $DOCKER_IMAGE:$PREVIOUS_TAG..."
docker pull "$DOCKER_IMAGE:$PREVIOUS_TAG"

echo "Stopping current container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "Starting previous version..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$PORT:3000" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e APP_VERSION="$PREVIOUS_TAG-rollback" \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  "$DOCKER_IMAGE:$PREVIOUS_TAG"

echo "=== Rollback Health Check ==="
for i in $(seq 1 $MAX_RETRIES); do
  echo "Attempt $i/$MAX_RETRIES..."
  if docker run --rm --network host curlimages/curl:latest \
    -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" | grep -q "200"; then
    echo "Rollback health check passed!"
    if [ -n "$WEBHOOK_URL" ]; then
      echo "Sending rollback notification..."
      curl -s -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"Rollback complete: $DOCKER_IMAGE reverted to $PREVIOUS_TAG\"}" || true
    fi
    exit 0
  fi
  sleep $RETRY_DELAY
done

echo "Rollback health check failed. Manual intervention required."
exit 1
