#!/bin/sh
set -e

DOCKER_IMAGE="${DOCKER_IMAGE:-mrsridoc/node-ci-app}"
DEPLOY_TAG="${DEPLOY_TAG:-latest}"
CONTAINER_NAME="ci-cd-nodeapp"
PORT="${PORT:-3000}"
MAX_RETRIES=5
RETRY_DELAY=5

echo "=== Deploying $DOCKER_IMAGE:$DEPLOY_TAG ==="

echo "Pulling image $DOCKER_IMAGE:$DEPLOY_TAG..."
docker pull "$DOCKER_IMAGE:$DEPLOY_TAG"

echo "Stopping existing container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "Starting new container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$PORT:3000" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e APP_VERSION="$DEPLOY_TAG" \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  "$DOCKER_IMAGE:$DEPLOY_TAG"

echo "=== Health Check ==="
for i in $(seq 1 $MAX_RETRIES); do
  echo "Attempt $i/$MAX_RETRIES..."
  if docker run --rm --network host curlimages/curl:latest \
    -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" | grep -q "200"; then
    echo "Health check passed!"
    exit 0
  fi
  sleep $RETRY_DELAY
done

echo "Health check failed after $MAX_RETRIES attempts"
exit 1
