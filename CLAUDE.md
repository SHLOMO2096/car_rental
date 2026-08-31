# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hebrew (RTL) car-rental management system: FastAPI + SQLAlchemy + PostgreSQL backend, React 18 + Vite frontend, deployed via Docker Compose behind a shared Traefik `infra-proxy`. `README.md` is written in Hebrew and holds the deployment/ops details; `docs/` holds specs (`reassignment-engine-spec.md`, `rbac-v2-spec.md`, `gitops-runbook.md`).

## Commands

Backend (from `backend/`):

```bash
uvicorn app.main:app --reload --port 8000     # dev server (needs DATABASE_URL + SECRET_KEY)
pytest -q                                     # all tests (pytest.ini: testpaths=tests, pythonpath=.)
pytest tests/test_pricing_service.py -q       # single file
pytest tests/test_api.py::test_name -q        # single test
alembic revision --autogenerate -m "..."      # new migration
alembic upgrade head                          # apply
python seed.py                                # admin@rental.co.il / Admin1234! + fleet data
```

Frontend (from `frontend/`):

```bash
npm run dev        # Vite on :5173
npm run test:run   # vitest once (npm test = watch)
npm run build      # what CI gates on — there is no lint step
```

Docker (repo root): `docker compose up -d` (postgres :5433, redis :6379, backend :8000, frontend :5173), then `docker compose exec backend python seed.py`.

Tests need `DATABASE_URL` and `SECRET_KEY` set (CI uses `sqlite:///./test_bootstrap.db` + `ci-secret-key`); `backend/tests/test_api.py` then overrides `get_db` with an in-memory SQLite `StaticPool` session. The Redis integration tests skip themselves unless a reachable `TEST_REDIS_URL` is set (`docker compose up -d redis` first).

CI (`.github/workflows/ci.yml`) runs backend pytest + frontend build only. `deploy-dev.yml` auto-deploys on push to `development`; production deploy/rollback are manual `workflow_dispatch`.

## Backend architecture

Strict layering under `backend/app/`: `models/` (SQLAlchemy) → `schemas/` (Pydantic v2) → `crud/` (extends the generic `CRUDBase` in `crud/base.py`) → `routers/` (endpoints) → registered in `main.py` under `/api/<module>`. `services/` holds business logic reused by routers; `engine/` is the suggestion/reassignment engine; `tasks/email_tasks.py` runs via FastAPI `BackgroundTasks`.

- **Schema management**: `main.py` calls `Base.metadata.create_all` **only when `DEBUG`**. Production schema changes must go through Alembic, or Alembic and the live DB desync (`DuplicateTable`). Add new model imports to `alembic/env.py` — it imports models explicitly, not via a package star, so a model missing there is invisible to autogenerate.
- **AuthZ**: permission keys live in `core/permissions.py` (`Permissions` + `ROLE_PERMISSIONS` for `agent`/`admin`) and are enforced with `Depends(require_permission(Permissions.X))` from `core/security.py`. `require_booking_scope_or_admin` additionally restricts agents to their own bookings. `agent` currently holds `PRICING_MANAGE` as a marked temporary grant pending RBAC v2.
- **Audit + alerts**: sensitive mutations (booking create/update/delete, price override, reassignment apply) call `log_audit_event(...)` with before/after JSON and a severity, and fire a manager email from `core/email.py` (`send_*_alert`). When adding such a path, follow both halves — the reassignment spec's rule is that nothing significant happens silently.
- **Pricing** (`services/pricing.py`): `resolve_price()` is a pure function. Price resolution inherits across four levels — `car` → `model` → `category` → `global` (`PriceEntityType`) — with per-field fallback (any `null` field on a `PriceRule` inherits upward), then season adjustments from `Season`/`SeasonRule` are applied per date segment. Bookings store the result denormalized (`billable_days`, `price_type_used`, `price_rule_id`, `price_breakdown_json`) plus an optional `price_override` audit trio. See `BUG_FIX_HALF_DAY_CALCULATION.md` for the half-day/remainder rules.
- **Suggestions engine** (`engine/`): `candidates.py` generates Type A (exact car free), Type B (same/adjacent group free) and Type C (move one blocking booking to free the target car); `constraints.py` gates validity, `scoring.py` ranks, `explainer.py` produces the agent-facing rationale. Applying a Type C move requires a short-lived apply token (`create_suggestion_apply_token`) bound to the actor, and re-validates constraints inside the transaction.
- **Soft delete**: bookings use `deleted_at`/`deleted_by` — filter them out in new queries rather than hard-deleting.

## Frontend architecture

`App.jsx` owns routing, the RTL sidebar layout and lazy-loaded pages. Auth lives in `store/auth.js` (Zustand + `persist`); `api/client.js` is the single axios instance that injects the JWT and `X-Device-Id`, normalizes Pydantic error arrays into a `{status, detail, headers}` rejection, and force-logs-out on 401.

- **Permissions are duplicated**: `frontend/src/permissions.js` mirrors `backend/app/core/permissions.py`. Changing a role's permissions requires editing both, or the UI and API disagree.
- **Two page styles coexist**: most `pages/*.jsx` are large self-contained components (Dashboard is ~1700 lines), while bookings has been extracted into `features/bookings/` (page + `components/` + `hooks/` + `utils/`), with `pages/Bookings.jsx` left as a re-export facade. Prefer the `features/` decomposition for substantial new work.
- Styling is inline JS objects with `dir="rtl"`; there is no CSS framework. Mobile is handled via `useIsMobile(breakpoint)` with separate mobile branches (Bottom Sheet, Quick Search) rather than media queries.
- Tests live in `src/test/` (vitest + Testing Library, jsdom, globals on) and cover permission models and smoke flows, not full pages.

## Deployment

GitOps without a registry: CI runs tests, then SSHes to the server and pipes `scripts/deploy_*.sh` in over stdin (so the script that runs is the one from the triggering ref, not the server's checkout). The server does `git checkout --force <SHA>` + `reset --hard` — it is a mirror of a commit, local edits there are destroyed — then `docker compose up -d --build`, `alembic upgrade head`, and health checks (internal `127.0.0.1:8000/health`, plus `--resolve` through Traefik in production).

- **dev**: auto on push to `development` → `/opt/car-rental-dev`, `.env.development`, `docker-compose.yml` **+ overlay** `docker-compose.dev-server.yml`, host `dev.waycar.co.il`.
- **prod**: manual `workflow_dispatch` only (the push trigger is deliberately commented out) → `/opt/car-rental`, `.env.production`, `docker-compose.prod.yml`. `rollback-prod.yml` reruns the same script at an older SHA, so a rollback does **not** downgrade the DB — see `docs/gitops-runbook.md`.
- Traefik lives in the separate `infra-proxy` repo and owns 80/443, the external `traefik-public` network, TLS and the `*@file` middlewares. This repo only declares router labels; router priority orders them (web 1 < api 100 < health 150 < login 200, login getting a stricter rate-limit middleware). No host ports are published in either server stack.
- **Compose merge trap**: the dev server merges two compose files. `environment` maps merge key-by-key (later file wins), but `ports`/`volumes` sequences are **concatenated**, so `ports: []` removes nothing — use `!reset null` (Compose v2.24+). Verify any change to those files with `docker compose --env-file <env> -f ... -f ... config` before pushing.
- `docker-compose.yml` reads the backend env from `env_file: ./backend/.env` (untracked; `cp backend/.env.example backend/.env` locally, and the dev deploy script writes it from `.env.development`). Values under a service's `environment:` key override that file — `DATABASE_URL` and `DEBUG` are set there.

## Conventions

- UI strings, email templates and many code comments are Hebrew. Keep user-facing text Hebrew and RTL-correct.
- `.gitattributes` forces LF for all text files — do not reintroduce CRLF.
- Commits follow Conventional Commits with a scope, e.g. `feat(dashboard): ...`, `fix(bookings): ...`.
- Version `2.0.0` is duplicated in `backend/app/core/config.py` (`APP_VERSION`) and `frontend/package.json`; bump both together and record it in `CHANGELOG.md`.
- Adding a module means touching, in order: `models/` → `schemas/` → `crud/` → `routers/` → `main.py` include_router → `frontend/src/api/<module>.js` → page → `App.jsx` route + NavLink (+ permission keys on both sides if it is gated).
- `scratch/` holds throwaway prototypes; keep experiments there rather than in `src/`.
