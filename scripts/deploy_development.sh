#!/usr/bin/env bash
# Deploy script for the development environment.
# Expected environment variables (injected by CI or set manually):
#   REPO_DIR    – path on the dev server where the repo lives  (default: /opt/car-rental-dev)
#   REPO_URL    – git clone URL (required on first deploy only)
#   TARGET_SHA  – exact commit to deploy (required)
#   ENV_FILE    – .env file to use                              (default: .env.development)
#   COMPOSE_FILE – docker-compose override                      (default: docker-compose.yml)
set -euo pipefail

# Ensure docker is on PATH (common locations when running via non-login SSH)
export PATH="/usr/local/bin:/usr/bin:$PATH"

REPO_DIR="${REPO_DIR:-/opt/car-rental-dev}"
REPO_URL="${REPO_URL:-}"
TARGET_SHA="${TARGET_SHA:-}"
ENV_FILE="${ENV_FILE:-.env.development}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [[ -z "$TARGET_SHA" ]]; then
  echo "ERROR: TARGET_SHA is required"
  exit 1
fi

mkdir -p "$REPO_DIR"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  if [[ -z "$REPO_URL" ]]; then
    echo "ERROR: REPO_URL is required for first deploy"
    exit 1
  fi
  echo "First deploy: cloning repository into $REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git config --global --add safe.directory "$REPO_DIR"

echo "Ensuring shared Docker networks exist..."
docker network create car_rental_dev_default >/dev/null 2>&1 || true

echo "Fetching repository state..."
git fetch --all --tags --prune
git checkout --force "$TARGET_SHA"
git reset --hard "$TARGET_SHA"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found in $REPO_DIR"
  echo ""
  echo "Run these commands on the server to create it:"
  echo "  cp $REPO_DIR/.env.development.example $REPO_DIR/$ENV_FILE"
  echo "  nano $REPO_DIR/$ENV_FILE   # fill in SECRET_KEY and other values"
  exit 1
fi

# The backend service in docker-compose.yml loads ./backend/.env into the
# container – keep it in sync with the active env file.
echo "Syncing $ENV_FILE -> backend/.env ..."
cp "$ENV_FILE" backend/.env

echo "Validating docker compose configuration..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

echo "Starting development stack..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "Waiting for backend container health..."
for i in $(seq 1 15); do
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend \
      python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5).read()" \
      >/dev/null 2>&1; then
    echo "Backend responded successfully on attempt $i"
    break
  fi

  if [[ "$i" -eq 15 ]]; then
    echo "Backend health check failed after 15 attempts"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=100 backend frontend
    exit 1
  fi

  sleep 3
done

echo "Development deploy completed for $TARGET_SHA"

