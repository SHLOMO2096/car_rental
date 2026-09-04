# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hebrew (RTL) car-rental management system: FastAPI + SQLAlchemy + PostgreSQL backend, React 18 + Vite frontend, deployed via Docker Compose behind a shared Traefik `infra-proxy`. `README.md` is written in Hebrew and holds the deployment/ops details; `docs/` holds specs (`reassignment-engine-spec.md`, `rbac-v2-spec.md`, `incidents-media-spec.md`, `gitops-runbook.md`).

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

CI (`.github/workflows/ci.yml`) runs backend pytest, the frontend design-principles audit, frontend vitest and the frontend build; the two deploy workflows re-run the same four before shipping. `deploy-dev.yml` auto-deploys on push to `development`; production deploy/rollback are manual `workflow_dispatch`.

## Backend architecture

Strict layering under `backend/app/`: `models/` (SQLAlchemy) → `schemas/` (Pydantic v2) → `crud/` (extends the generic `CRUDBase` in `crud/base.py`) → `routers/` (endpoints) → registered in `main.py` under `/api/<module>`. `services/` holds business logic reused by routers; `engine/` is the suggestion/reassignment engine; `tasks/email_tasks.py` runs via FastAPI `BackgroundTasks`.

- **Schema management**: `main.py` calls `Base.metadata.create_all` **only when `DEBUG`**. Production schema changes must go through Alembic, or Alembic and the live DB desync (`DuplicateTable`). Add new model imports to `alembic/env.py` — it imports models explicitly, not via a package star, so a model missing there is invisible to autogenerate.
- **AuthZ**: permission keys live in `core/permissions.py` (`Permissions` + `ROLE_PERMISSIONS` for `agent`/`admin`) and are enforced with `Depends(require_permission(Permissions.X))` from `core/security.py`. `require_booking_scope_or_admin` additionally restricts agents to their own bookings. `agent` currently holds `PRICING_MANAGE` as a marked temporary grant pending RBAC v2.
- **Audit + alerts**: sensitive mutations (booking create/update/delete, price override, reassignment apply) call `log_audit_event(...)` with before/after JSON and a severity, and fire a manager email from `core/email.py` (`send_*_alert`). When adding such a path, follow both halves — the reassignment spec's rule is that nothing significant happens silently.
- **Pricing** (`services/pricing.py`): `resolve_price()` is a pure function. Price resolution inherits across four levels — `car` → `model` → `category` → `global` (`PriceEntityType`) — with per-field fallback (any `null` field on a `PriceRule` inherits upward), then season adjustments from `Season`/`SeasonRule` are applied per date segment. Bookings store the result denormalized (`billable_days`, `price_type_used`, `price_rule_id`, `price_breakdown_json`) plus an optional `price_override` audit trio. See `BUG_FIX_HALF_DAY_CALCULATION.md` for the half-day/remainder rules.
- **Suggestions engine** (`engine/`): `candidates.py` generates Type A (exact car free), Type B (same/adjacent group free) and Type C (move one blocking booking to free the target car); `constraints.py` gates validity, `scoring.py` ranks, `explainer.py` produces the agent-facing rationale. Applying a Type C move requires a short-lived apply token (`create_suggestion_apply_token`) bound to the actor, and re-validates constraints inside the transaction.
- **Temporary car blocks** (`models/car_block.py` → `/api/car-blocks`): a `CarBlock` makes one car unbookable for a date range without deactivating it, for a garage visit or an accident. Three places enforce it and all three must stay in step — `routers/bookings.py` (`_reject_if_blocked`, on create, car change and date change), `engine/constraints.py` (`is_car_available`, so the engine never proposes a car that is in the garage) and the create/update endpoints themselves, which refuse a block that would sit on top of an active booking. Blocks are soft-deleted like bookings, so a cancelled block stays in the audit trail.
- **Soft delete**: bookings use `deleted_at`/`deleted_by` — filter them out in new queries rather than hard-deleting.

## Frontend architecture

`App.jsx` owns routing, the RTL sidebar layout and lazy-loaded pages. Auth lives in `store/auth.js` (Zustand + `persist`); `api/client.js` is the single axios instance that injects the JWT and `X-Device-Id`, normalizes Pydantic error arrays into a `{status, detail, headers}` rejection, and force-logs-out on 401.

- **Permissions are duplicated**: `frontend/src/permissions.js` mirrors `backend/app/core/permissions.py`. Changing a role's permissions requires editing both, or the UI and API disagree.
- **Two page styles coexist**: most `pages/*.jsx` are large self-contained components (Dashboard is ~1700 lines), while bookings has been extracted into `features/bookings/` (page + `components/` + `hooks/` + `utils/`), with `pages/Bookings.jsx` left as a re-export facade. Prefer the `features/` decomposition for substantial new work.
- **Styling is mid-migration.** `src/styles/` (`tokens.css` → `presets.css` → `base.css` → `components.css`, imported in that order in `main.jsx`) is the new source of truth. `tokens.css` is two-tier: a short **dials** block at the top (`--brand`, `--font-ui`, `--font-display`, `--text-base`, `--text-scale`, `--radius`, and the `--n-*` neutral ramp) followed by derived values that must not be edited by hand — brand shades come from `color-mix(in oklab, var(--brand) …)` over a literal fallback, and the type scale is `calc()`-chained off `--text-base`. So changing the brand colour or the typeface is a one-line edit. `presets.css` supplies ready alternatives switched by attribute on `<html>` (`data-brand`, `data-neutral`, `data-density`). `components.css` holds `.btn` / `.input` / `.card` / `.badge` / `.alert` / `.modal` / `.toast` / `.table` with the `:hover` / `:focus` / `:disabled` states, media queries and keyframes that inline styles cannot express.
- The default token values deliberately match the slate/blue hexes already hardcoded across the app, so migrated and unmigrated screens look identical during the transition. Migrated so far: `pages/Login.jsx` (reference screen) and all of `components/ui/` (Modal, Badge, Confirm, ToastHost) — the latter means every screen already gets the new modal, badge, confirm and toast. Everything else is still inline JS style objects; an inline `style` always beats a class, so a screen must drop its style object when it adopts the classes. No CSS framework and no dark mode yet (most screens still hardcode their own backgrounds).
- **Palette.** `--brand` is a deep pine `#154038` and the neutral ramp is a green-tinted grey, chosen because the product's main surface — the availability grid — already carries a 10-hue categorical palette for car models, so coloured chrome would compete with the data. Every text/surface pair in `tokens.css` was checked to meet WCAG AA (body 9.65:1, muted 4.59:1, metadata 3.06:1, white on brand 11.52:1); keep new steps above those floors. `Dashboard.jsx`'s `MODEL_COLOR_PALETTE` is a validated categorical set — it passes the all-pairs CVD and normal-vision gates, which the previous palette hard-failed. **If you change it, re-run the `dataviz` skill's `scripts/validate_palette.js` with `--pairs all`** rather than picking colours by eye; separation there comes from varying lightness as well as hue.
- **Row actions follow one pattern**: one primary action stays visible and the rest go into `components/ui/ActionMenu.jsx` (a real `role="menu"` with arrow-key navigation, Escape-to-close that restores focus without closing a surrounding modal, and the destructive item separated and coloured only on hover/focus). Applied in customers, bookings, cars, pricing and users. Do not reintroduce rows of individually tinted action pills — that was the thing being replaced.
- **`npm run audit:ui`** turns the design review's principles into numbers: inline `outline:"none"`, native `confirm()`/`alert()`, physical spacing properties, emoji, hardcoded hexes, hardcoded font names, and how many screens use the component classes. One of its checks earns particular attention: **orphaned style references**. `style={s.foo}` pointing at a key that no longer exists evaluates to `undefined`, React ignores it, and the build, the tests and every other gate stay green while the styling silently disappears — so deleting entries from a screen's style object must be verified, never assumed. Principles that are already closed carry a budget of 0, and **`npm run audit:ui:strict` runs in CI and in both deploy workflows** — reintroducing one fails the build before it ships. The hex count and the migrated-screen count are untargeted; they are debt that should go down as screens migrate. When a check's budget is met for the first time, tighten the budget rather than leaving it slack.
- **`components/dev/ThemeLab.jsx`** is a dev-only floating panel for trying brand colour, neutral ramp, font pairing, base size and radius live, and it prints the resulting dials to paste into `tokens.css`. It is mounted from `App.jsx` behind `import.meta.env.DEV` via `lazy()`, so it is tree-shaken out of production builds — verify that stays true if you touch the mount.
- **`frontend/lab.html` + `frontend/scratch/lab.jsx` is the mobile lab** — it renders the **real page components** against a mocked axios adapter (`scratch/fixtures.js` supplies the data, the auth store is seeded with an admin) and prints an overflow report naming every element that spills past the viewport. Drive it with `scratch/probe.mjs` over CDP: start `npx vite --port 5201`, start Chrome with `--headless=new --remote-debugging-port=9333`, then `node probe.mjs [--shot] [--w=390] <screen>...`. It exists because the build, the tests and `audit:ui` all measure structure, not layout: a button can sit 32px outside its dialog with every gate green — which is exactly what shipped. Three rules the instrument itself taught, each after it produced a wrong answer: **emulate the device** (`Emulation.setDeviceMetricsOverride`) rather than sizing a `<div>`, because `useIsMobile` reads `window.innerWidth` and a narrow div in a wide window renders every page's desktop branch; **skip elements clipped by a scrolling ancestor**, or every table inside `overflow:auto` is reported as broken; and **run `?selftest=1`** — it injects a 900px div, and if the report does not flag it, a clean sweep means nothing. `vite build` only takes `index.html`, so the lab never reaches production.
- Mobile is handled via `useIsMobile(breakpoint)` with separate mobile branches (Bottom Sheet, Quick Search) rather than media queries.
- Tests live in `src/test/` (vitest + Testing Library, jsdom, globals on) and cover permission models, smoke flows and — in `ui.interaction.test.jsx` — the behaviour of the shared UI primitives. That file exists because two real bugs (focus jumping out of a field after one keystroke, a menu that would not dismiss) passed the build, the other tests and the design-principles gate without a sound: everything else measures static structure. When a shared component gains interactive behaviour, add a case there, and confirm it fails with the behaviour removed before trusting it.

## Deployment

GitOps without a registry: CI runs tests, then SSHes to the server and pipes `scripts/deploy_*.sh` in over stdin (so the script that runs is the one from the triggering ref, not the server's checkout). The server does `git checkout --force <SHA>` + `reset --hard` — it is a mirror of a commit, local edits there are destroyed — then `docker compose up -d --build`, `alembic upgrade head`, and health checks (internal `127.0.0.1:8000/health`, plus `--resolve` through Traefik in production).

- **dev**: auto on push to `development` → `/opt/car-rental-dev`, `.env.development`, `docker-compose.yml` **+ overlay** `docker-compose.dev-server.yml`, host `dev.waycar.co.il`.
- **prod**: manual `workflow_dispatch` only (the push trigger is deliberately commented out) → `/opt/car-rental`, `.env.production`, `docker-compose.prod.yml`. `rollback-prod.yml` reruns the same script at an older SHA, so a rollback does **not** downgrade the DB — see `docs/gitops-runbook.md`.
- **The deploy must not depend on server-local git config.** Both scripts force `origin` to the CI-supplied `REPO_URL` and fetch only that remote. They used to run `git fetch --all`, which pulls every remote configured on that box — a stray authenticated remote nobody remembers adding made `git` prompt for a username with no tty and killed the deploy with exit 128. The server is a mirror the deploy overwrites, so nothing about the deploy may rest on hand-configured state there.
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
