#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/car-rental}"
REPO_URL="${REPO_URL:-}"
TARGET_SHA="${TARGET_SHA:-}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PUBLIC_HOST_OVERRIDE="${PUBLIC_HOST_OVERRIDE:-}"

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
docker network create car_rental_default >/dev/null 2>&1 || true
docker network create traefik-public >/dev/null 2>&1 || true

echo "Fetching repository state..."
# ‎--all‎ מושך כל רמוט שמוגדר על השרת, כולל כאלה שדורשים אימות ושאיש לא
# זוכר שהוסיף — ופריסה נכשלה בדיוק כך: git ביקש שם משתמש, אין tty, exit 128.
# מצב הרמוטים הוא הגדרה ידנית על קופסה שהפריסה עצמה דורסת, ולכן אסור לה
# להיות תלות. כאן origin נקבע מ-REPO_URL ונמשך הוא בלבד.
if [[ -n "$REPO_URL" ]]; then
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REPO_URL"
  else
    git remote add origin "$REPO_URL"
  fi
fi
# קלון עם --single-branch משאיר refspec מצומצם, ואז ה-SHA המבוקש לא יורד.
git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git fetch --prune --tags origin
git checkout --force "$TARGET_SHA"
git reset --hard "$TARGET_SHA"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found in $REPO_DIR"
  echo "Run: cp .env.production.example $ENV_FILE && edit the real values"
  exit 1
fi

echo "Validating docker compose configuration..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

echo "Starting production stack..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "Running database migrations..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend alembic upgrade head

echo "Waiting for backend container health..."
for i in $(seq 1 15); do
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5).read()" >/dev/null 2>&1; then
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

PUBLIC_HOST="$PUBLIC_HOST_OVERRIDE"
if [[ -z "$PUBLIC_HOST" ]]; then
  PUBLIC_HOST="$(grep -E '^PUBLIC_HOST=' "$ENV_FILE" | tail -n1 | cut -d '=' -f2- | tr -d '\r')"
fi

if [[ -z "$PUBLIC_HOST" ]]; then
  echo "ERROR: PUBLIC_HOST is missing from $ENV_FILE"
  exit 1
fi

echo "Waiting for Traefik edge health on https://$PUBLIC_HOST/health ..."
for i in $(seq 1 15); do
  if curl --fail --silent --show-error --resolve "$PUBLIC_HOST:443:127.0.0.1" "https://$PUBLIC_HOST/health" >/dev/null 2>&1; then
    echo "Edge health check passed on attempt $i"
    echo "Production deploy completed for $TARGET_SHA"
    exit 0
  fi

  if [[ "$i" -eq 15 ]]; then
    echo "Traefik edge health check failed after 15 attempts"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=100 backend frontend
    echo "Hint: make sure infra-proxy is running and PUBLIC_HOST points to this server."
    exit 1
  fi

  sleep 3
done

