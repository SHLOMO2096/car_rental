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

Recommended:

- Protect `main` branch with required checks (`CI / backend-tests`, `CI / frontend-build`).
- Add required reviewers for `production` environment.

## 3) One-time server bootstrap

Run on the production server:

```bash
sudo apt-get update
sudo apt-get install -y git docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"

sudo mkdir -p /opt/car-rental
sudo chown -R "$USER":"$USER" /opt/car-rental
```

Clone once:

```bash
git clone <YOUR_REPO_SSH_OR_HTTPS_URL> /opt/car-rental
cd /opt/car-rental
cp .env.production.example .env.production
```

Edit `.env.production` with real secrets.

## 4) CI workflow

File: `.github/workflows/ci.yml`

- Runs on push/PR.
- Executes backend tests (`pytest -q`).
- Builds frontend (`npm run build`).

## 5) Production deploy workflow

File: `.github/workflows/deploy-prod.yml`

- Triggered by push to `main` or manual dispatch.
- Re-runs verify stage (tests + frontend build).
- SSH into server, checkout exact commit SHA, run:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --remove-orphans
```

- Performs health check:

```bash
curl -fsS http://localhost/health
```

## 6) Rollback workflow

File: `.github/workflows/rollback-prod.yml`

- Manual dispatch with required `git_ref` (tag/SHA).
- SSH into server, checkout target ref, redeploy stack.
- Runs same health check.

## 7) Daily operations

Deploy current `main`:

1. Merge PR to `main`.
2. Wait for `Deploy Production` workflow success.

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

