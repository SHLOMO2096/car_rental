# 📋 Deployment Readiness Checklist

## ✅ Completed Checks (2026-04-28)

### Backend
- [x] All tests passing (`37 passed`)
  - RBAC tests updated to reflect policy: agents can view reports and all bookings
  - Suggestions token validation working correctly
  - Audit logging functional

### Frontend
- [x] Production build successful (`vite build`)
- [x] API calls aligned with backend (no stray `model` parameters)
- [x] Dashboard grid with sticky headers and car category colors
- [x] Model selector removed from Dashboard (reports show global data)
- [x] Reports.jsx and Dashboard.jsx fully tested with corrected API calls

### Docker & Infra
- [x] `docker-compose.prod.yml` validates cleanly with `.env.production.example`
- [x] All required services defined (db, backend, frontend)
- [x] Database healthcheck configured
- [x] Network and volumes configured
- [x] Traefik labels configured for public routes

---

## 🚀 Pre-Deployment Steps

### 1. Environment Setup
Create `.env.production` from `.env.production.example`:
```bash
cd C:\Users\shlomo\PycharmProjects\car_rental

# Generate secret key (run this on Linux/Mac or WSL):
# openssl rand -hex 32

# Edit .env.production with:
DB_USER=carrental
DB_PASSWORD=<STRONG_RANDOM_PASSWORD>
DB_NAME=carrental
SECRET_KEY=<STRONG_32_BYTE_HEX_SECRET>
FRONTEND_URL=https://your-actual-domain.co.il
PUBLIC_HOST=your-actual-domain.co.il
EMAILS_ENABLED=false
SECURITY_ALERT_RECIPIENTS=ops@your-domain.co.il
```

### 1.5 Shared proxy prerequisites
```bash
# Run once on the production server
docker network create traefik-public || true
docker network create car_rental_default || true
```

Make sure the separate `infra-proxy` project is already running on the server and owns ports `80/443`.

Additional must-have production settings:

- `TRAEFIK_DASHBOARD_HOST` in the separate `infra-proxy` project must **not** equal `PUBLIC_HOST` of `car_rental`.
- If the domain is proxied through Cloudflare, set `SSL/TLS` mode to `Full` or `Full (strict)`.
- Do **not** use Cloudflare `Flexible`, otherwise the public site can get stuck in redirect loops.
- If the proxy host logs `client version 1.24 is too old` from Traefik's Docker provider, pin Docker Engine/CLI on the proxy host to `28.5.2` until the compatibility issue is resolved upstream.

### 2. Build Production Images
```powershell
cd C:\Users\shlomo\PycharmProjects\car_rental
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

### 3. Start Services
```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### 4. Smoke Tests
```powershell
# Public health check דרך Traefik
curl https://your-actual-domain.co.il/health
# Expected: {"status":"ok"}

# Important: use GET for /health. HEAD/"curl -I" may return 405 while the app is healthy.

# Backend auth route
curl https://your-actual-domain.co.il/api/auth/me
# Expected: 401 (no token provided)

# Login as admin
curl -X POST https://your-actual-domain.co.il/api/auth/login `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "username=admin@example.com&password=AdminPassword123!"
# Expected: {"access_token": "..."}

# Check dashboard data
curl -H "Authorization: Bearer <TOKEN>" https://your-actual-domain.co.il/api/reports/summary
# Expected: {"total": N, "active": M, "revenue": X}

# List bookings
curl -H "Authorization: Bearer <TOKEN>" https://your-actual-domain.co.il/api/bookings/
# Expected: [...]

# Frontend loads
curl https://your-actual-domain.co.il/
# Expected: HTML with index.html
```

### 5. Database Initialization
If first deployment, backend container should auto-run Alembic migrations on startup.
Verify in logs:
```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml logs backend | Select-String -Pattern "alembic|migration"
```

### 6. GitHub Actions automatic deployment

Create a GitHub Environment named `production` and add:

- `PROD_HOST`
- `PROD_USER`
- `PROD_PORT` (optional)
- `PROD_SSH_KEY`
- `SSH_KNOWN_HOSTS` (recommended)

On each push to `main`, `deploy-prod.yml` will rerun backend tests + frontend build, SSH into the server, deploy with Docker Compose, and verify health internally and through Traefik.

---

## 🔄 Post-Deployment Verification

- [ ] Frontend loads at `https://your-domain.co.il`
- [ ] `curl https://your-domain.co.il/health` returns JSON over the public domain
- [ ] Users can log in
- [ ] Dashboard displays stats and availability grid
- [ ] Agents see all bookings (not just their own)
- [ ] Agents can access `/api/reports/summary` (200 OK)
- [ ] Creating a booking with conflict shows inline suggestions
- [ ] Audit logs record actions
- [ ] No error logs in backend/frontend containers

---

## 📋 Key Features Ready for Production

1. **RBAC & Permissions**
   - Admin: full access
   - Agent: can view all bookings, reports, and suggest reassignments (within scope)

2. **Smart Bookings**
   - Auto-fills today/tomorrow with 08:00 defaults
   - Shows inline conflict suggestions (Type A/B/C)
   - No separate suggestions tab

3. **Dashboard**
   - Availability grid: color-coded by car category and booking type
   - Sticky headers (freeze panes) for dates and car names
   - Reports cards visible to both admin and agent

4. **Backend Robustness**
   - Pydantic v2 error handling (422 detail flattened for UI)
   - Rate limiting for suggestions API
   - Comprehensive audit logging
   - Database migrations up-to-date

5. **Frontend Polish**
   - Build info badge with version and timestamp
   - Responsive layout
   - Hebrew localization throughout

---

## 🛠 Rollback Plan

If issues arise post-deployment:
```powershell
# Stop all containers
docker compose --env-file .env.production -f docker-compose.prod.yml down

# Restore from backup (if applicable)
# Volume: pg_data contains PostgreSQL data

# Or downgrade to previous image tag
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --remove-orphans
```

---

## 📞 Support Contacts

- **Ops**: ops@your-domain.co.il
- **Security**: security@your-domain.co.il

---

**Last Updated:** 2026-05-12
**Status:** ✅ Ready for Production Deployment / GitHub Actions Auto-Deploy

