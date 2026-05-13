# GitOps Runbook (GitHub Actions + Docker Compose)

This project deploys production from git history.

## 1) Branch and release flow

- Work on `feature/*` branches.
- Open PRs into `main`.
- Production deploy is triggered from `main` only.
- Optional: deploy a specific commit/tag manually via workflow input.

## 2) Required GitHub configuration

Create a GitHub Environment named `production` and add these secrets:

- `PROD_HOST` - server hostname or IP.
- `PROD_USER` - SSH user for deployment.
- `PROD_PORT` - optional SSH port (default `22`).
- `PROD_SSH_KEY` - private key allowed to SSH to production server.
- `SSH_KNOWN_HOSTS` - optional pinned `known_hosts` entry for the server (recommended).

Recommended:

- Protect `main` branch with required checks (`CI / backend-tests`, `CI / frontend-build`).
- Add required reviewers for `production` environment.

## 3) One-time server bootstrap

Run on the production server:

```bash
sudo apt-get update
sudo apt-get install -y git docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"

docker network create traefik-public || true
docker network create car_rental_default || true

sudo mkdir -p /opt/car-rental
sudo chown -R "$USER":"$USER" /opt/car-rental
```

Before deploying `car_rental`, make sure the shared Traefik edge from the separate `infra-proxy` repository is already running and owns ports `80/443`.

### Shared Traefik / Cloudflare production requirements

- `PUBLIC_HOST` of `car_rental` must point to the public application hostname (for example `waycar.co.il`).
- In the separate `infra-proxy` project, `TRAEFIK_DASHBOARD_HOST` must use a **different** host (for example `traefik.waycar.co.il`) so the Traefik dashboard does not capture application traffic.
- If the public DNS is proxied by Cloudflare, set `SSL/TLS` mode to `Full` or `Full (strict)`.
- Do **not** use Cloudflare `Flexible`, because Traefik already redirects `web` → `websecure`, which causes public redirect loops.
- Public smoke tests for `/health` should use `GET` (`curl https://<host>/health`). A `HEAD` request (`curl -I`) may return `405` even while the app is healthy.
- Known proxy-host compatibility note: if Traefik logs `client version 1.24 is too old. Minimum supported API version is 1.40`, pin Docker Engine/CLI on the shared proxy host to `28.5.2` and hold those packages until Docker/Traefik compatibility is revalidated.

Clone once:

```bash
git clone <YOUR_REPO_SSH_OR_HTTPS_URL> /opt/car-rental
cd /opt/car-rental
cp .env.production.example .env.production
```

Edit `.env.production` with real secrets, including:

- `FRONTEND_URL=https://<your-domain>`
- `PUBLIC_HOST=<your-domain>`

> If the repository is private and the server itself does not have GitHub credentials, keep this one-time manual clone step. After that, GitHub Actions deploys by SSH + `git fetch` on the existing checkout.

### Important: changing `DB_PASSWORD` on existing data

If `pg_data` already exists, changing `DB_PASSWORD` in `.env.production` does **not** automatically rotate the DB user's password.

Use one of these options:

1. Keep data and rotate password in PostgreSQL:

```bash
cd /opt/car-rental
source .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml exec db \
  psql -U "$DB_USER" -d postgres -c "ALTER USER \"$DB_USER\" WITH PASSWORD 'NEW_PASSWORD';"
```

2. Recreate database (data loss): delete `pg_data` volume and redeploy.

Recommended: option 1.

## 4) CI workflow

File: `.github/workflows/ci.yml`

- Runs on push/PR.
- Executes backend tests (`pytest -q`).
- Builds frontend (`npm run build`).

Note: `.github/workflows/deploy.yml` is legacy and disabled. Use only `ci.yml`, `deploy-prod.yml`, and `rollback-prod.yml`.

## 5) Production deploy workflow

Files:

- `.github/workflows/deploy-prod.yml`
- `scripts/deploy_production.sh`

- Triggered by push to `main` or manual dispatch.
- Re-runs verify stage (tests + frontend build).
- SSH into server, checks out the exact commit SHA, ensures required Docker networks exist, validates Compose, then runs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --remove-orphans
```

- Performs two health checks:

1. Internal backend check from inside the `backend` container on `http://127.0.0.1:8000/health`
2. Public edge check through Traefik using `https://$PUBLIC_HOST/health`

```bash
curl --resolve "$PUBLIC_HOST:443:127.0.0.1" "https://$PUBLIC_HOST/health"
```

The workflow sends the current `scripts/deploy_production.sh` to the server over SSH, so deploy and rollback use the same logic.

### Production troubleshooting used during the Traefik migration

1. `curl --resolve "$PUBLIC_HOST:443:127.0.0.1" "https://$PUBLIC_HOST/health"` is the canonical origin test. It bypasses Cloudflare and proves whether Traefik + app routing are correct on the server.
2. If the origin test works but the public hostname returns `308` or `Moved Permanently` with `server: cloudflare`, fix Cloudflare SSL mode (`Full`, not `Flexible`).
3. If public requests return `www-authenticate: Basic realm="traefik"`, the Traefik dashboard host matches the app host; move the dashboard to a different subdomain.
4. If Traefik returns `404` for `/`, `/api`, and `/health`, inspect `infra-proxy` logs first; in our rollout this traced back to Docker API compatibility on the proxy host rather than labels in `car_rental`.

## 6) Rollback workflow

File: `.github/workflows/rollback-prod.yml`

- Manual dispatch with required `git_ref` (tag/SHA).
- SSH into server, checkout target ref, redeploy stack.
- Runs the same shared deploy script and the same health checks.

## 7) Daily operations

Deploy current `main`:

1. Merge PR to `main`.
2. Wait for `CI` and then `Deploy Production` workflow success.

Deploy specific tag/SHA:

1. Run `Deploy Production` manually.
2. Set `git_ref` to tag/SHA.

Rollback:

1. Run `Rollback Production`.
2. Set `git_ref` to last known good tag/SHA.

## 8) Recommended tagging

Create a tag before major production deployments:

```bash
git tag -a vYYYY.MM.DD-HHMM -m "production release"
git push origin --tags
```

This makes rollback quick and explicit.

## 9) Recommended GitHub environment protection

- Require manual approval for the `production` environment.
- Require `CI / backend-tests` and `CI / frontend-build` before merging to `main`.
- Prefer storing the SSH host fingerprint in `SSH_KNOWN_HOSTS` instead of relying only on runtime host discovery.

