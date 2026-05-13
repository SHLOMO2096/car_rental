<!-- Deploy trigger: revert to direct links -->
# 🚘 מערכת ניהול השכרת רכבים

מערכת production-ready לניהול השכרת רכבים — FastAPI + React + PostgreSQL.

## גרסאות ועדכונים

- גרסה נוכחית: `2.0.0`
- פירוט מלא של החידושים: `CHANGELOG.md`

## ארכיטקטורה

```
Backend:   Python 3.12 + FastAPI + SQLAlchemy + PostgreSQL
Frontend:  React 18 + Vite + React Router + Zustand + Recharts
Auth:      JWT (8 שעות) + bcrypt + הרשאות admin/agent
Email:     SMTP עם תבניות HTML
DevOps:    Docker + Traefik (shared infra-proxy) + GitHub Actions CI/CD
```

## הרצה מקומית

### דרישות
- Docker + Docker Compose
- Node.js 20+
- Python 3.12+

### התחלה מהירה

```bash
# 1. שכפל את הפרויקט
git clone https://github.com/your-org/car-rental.git
cd car-rental

# 2. צור קובץ .env
cp backend/.env.example backend/.env
# ערוך את backend/.env:
#   SECRET_KEY=$(openssl rand -hex 32)

# 3. הפעל עם Docker
docker-compose up -d

# 4. נתוני התחלה (פעם אחת)
docker-compose exec backend python seed.py

# 5. כניסה
# Frontend: http://localhost:5173
# API Docs:  http://localhost:8000/docs
# אימייל:   admin@rental.co.il
# סיסמה:   Admin1234!
```

### הרצה ידנית (ללא Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## מיגרציות DB (Alembic)

```bash
# יצירת מיגרציה חדשה
cd backend
alembic revision --autogenerate -m "add column X"

# הרצת מיגרציות
alembic upgrade head

# חזרה אחורה
alembic downgrade -1
```

## בדיקות

```bash
cd backend
pytest tests/ -v
```

## מודול לקוחות חדש

- לשונית `לקוחות` לניהול לקוחות, חיפוש מהיר והזמנה ישירה ללקוח.
- יצירת הזמנה עם חיפוש חכם (autocomplete) לפי שם/טלפון/מייל/תעודת זהות.
- אם מזינים לקוח חדש בהזמנה, הוא נשמר אוטומטית בטבלת `customers`.
- מסך לקוחות כולל היסטוריית הזמנות ללקוח וכפתור WhatsApp מהיר אם קיים מספר טלפון.
- במסך לקוחות יש גם עריכה, מחיקה, שליחת מייל, וייבוא קובץ CSV/Excel.
- אחרי ייבוא מוצג דוח מפורט עם שורות שדולגו ואזהרות/שגיאות לפי שורה.

### ניקוי וייבוא CSV לקוחות

הסקריפט/מסך הייבוא יודעים לקרוא קבצי CSV ו-Excel גם אם סדר העמודות שונה, כל עוד יש כותרות שאפשר למפות לשדות הרלוונטיים.

השדות הנתמכים:
- `name`
- `address`
- `phone`
- `email`
- `id_number`

```powershell
cd backend
python scripts/import_customers_from_csv.py --source "C:\Users\shlomo\Downloads\AccountsList.csv" --clean-out "data/customers_clean.csv"
```

ייבוא לבסיס הנתונים:

```powershell
cd backend
python scripts/import_customers_from_csv.py --source "C:\Users\shlomo\Downloads\AccountsList.csv" --clean-out "data/customers_clean.csv" --import-db
```

אם מריצים **מתוך Docker**, הנתיב `C:\Users\...` לא קיים בתוך הקונטיינר. במקרה כזה יש להשתמש בקובץ שנמצא בתוך `backend/data`:

```powershell
cd C:\Users\shlomo\PycharmProjects\car_rental
docker compose exec backend python scripts/import_customers_from_csv.py --source "data/customers_clean.csv" --clean-out "data/customers_clean.csv" --import-db
```

אם מריצים מקומית מחוץ ל-Docker, אפשר להגדיר DB אחר זמני:

```powershell
cd backend
python scripts/import_customers_from_csv.py --source "C:\Users\shlomo\Downloads\AccountsList.csv" --clean-out "data/customers_clean.csv" --import-db --database-url "sqlite:///./customers_import_test.db"
```

### בדיקת אינטגרציה ל-Rate Limit עם Redis

```powershell
docker compose up -d redis
cd backend
$env:TEST_REDIS_URL = "redis://localhost:6379/15"
python -m pytest tests/test_rate_limit_redis_integration.py -q
```

```powershell
docker compose up -d redis
cd backend
$env:TEST_REDIS_URL = "redis://localhost:6379/15"
python -m pytest tests/test_suggestions_redis_api_integration.py -q
```

## פריסה ל-Railway

1. צור חשבון ב-[railway.app](https://railway.app)
2. צור פרויקט חדש → Add Service → GitHub Repo
3. הוסף PostgreSQL: Add Service → Database → PostgreSQL
4. הגדר env vars:
   - `DATABASE_URL` — מקבל אוטומטית מ-Railway
   - `SECRET_KEY` — `openssl rand -hex 32`
   - `FRONTEND_URL` — URL של ה-frontend
5. Push ל-main → deploy אוטומטי

## פריסה ל-VPS (Ubuntu) — שלבים מלאים

### 1. דרישות בשרת
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER   # אופציונלי: הרצת docker ללא sudo
```

> חשוב: השרת אמור להריץ קודם את פרויקט `infra-proxy` עם Traefik, והוא זה שמחזיק את הפורטים `80/443` לכלל הפרויקטים.

### 2. שכפול הפרויקט
```bash
git clone https://github.com/your-org/car-rental.git /opt/car-rental
cd /opt/car-rental
docker network create traefik-public || true
docker network create car_rental_default || true
```

> אם הריפו פרטי, בצע את השכפול הראשוני הזה ידנית פעם אחת על השרת. לאחר מכן GitHub Actions יבצעו `git fetch` ו־deploy אוטומטי לאותה תיקייה.

### 3. קובץ סביבה לפרודקשן
```bash
cp .env.production.example .env.production
```
ערוך `.env.production` ומלא:
- `DB_PASSWORD` — סיסמה חזקה לבסיס הנתונים
- `SECRET_KEY` — הרץ `openssl rand -hex 32` וקבל ערך
- `FRONTEND_URL` — הדומיין שלך (למשל `https://rental.mysite.co.il`)
- `PUBLIC_HOST` — אותו דומיין שבו Traefik יחשוף את הפרויקט

### 3.5 דרישות Traefik / Cloudflare שחייבות להיות מוגדרות

- ב-`infra-proxy` יש להגדיר את `TRAEFIK_DASHBOARD_HOST` על סאב-דומיין נפרד, למשל `traefik.example.com`, **ולא** על `PUBLIC_HOST` של האפליקציה.
- אם הדומיין עובר דרך Cloudflare, מצב `SSL/TLS` חייב להיות `Full` או `Full (strict)`.
- אל תשתמש ב-`Flexible`, כי הוא יוצר לולאות redirect מול Traefik שמכריח HTTP → HTTPS.
- בדיקת health ציבורית צריכה להיות עם `GET` רגיל, למשל `curl https://your-domain.co.il/health`. בקשת `HEAD` (`curl -I`) עלולה להחזיר `405` למרות שהשירות תקין.
- אם `infra-proxy` מחזיר `404` על כל ה-routes ובלוגים של Traefik מופיע `client version 1.24 is too old`, זו בעיית תאימות Docker provider על השרת של ה-proxy. במקרה כזה יש לקבע את Docker Engine/CLI בשרת ה-proxy לגרסה `28.5.2` ולעצור עדכונים אוטומטיים עד לאימות תאימות מול Traefik.

### 4. הרצה
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### 5. יצירת משתמש admin ודאטה ראשוני (פעם אחת בלבד)
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python seed.py
```

### 6. בדיקה
```bash
curl https://your-domain.co.il/health
# ציפייה: {"status":"ok"}
```

בדיקות ציבוריות נוספות:

```bash
curl https://your-domain.co.il/api/auth/me
# ציפייה: 401 ללא טוקן

curl https://your-domain.co.il/
# ציפייה: HTML של ה-frontend
```

### עדכון גרסה עתידי
```bash
cd /opt/car-rental
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## GitOps לפרודקשן (GitHub Actions)

הפרויקט כולל כעת אוטומציה מלאה ב-`.github/workflows/`:

- `ci.yml` - בדיקות backend + build ל-frontend בכל PR/Push.
- `deploy-prod.yml` - פריסה אוטומטית ל-production ב-push ל-`main` (או ידנית ל-ref ספציפי).
- `rollback-prod.yml` - rollback ידני לפי tag/SHA.

### סודות נדרשים ב-GitHub Environment בשם `production`

- `PROD_HOST`
- `PROD_USER`
- `PROD_PORT` (אופציונלי, ברירת מחדל 22)
- `PROD_SSH_KEY`
- `SSH_KNOWN_HOSTS` (מומלץ)

### מה קורה אוטומטית ב־deploy

- ה־workflow מריץ שוב backend tests ו־frontend build
- מתחבר ב־SSH לשרת
- בודק שהרשתות `traefik-public` ו־`car_rental_default` קיימות
- עושה checkout ל־commit המדויק של ה־deploy
- מריץ `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --remove-orphans`
- בודק health גם פנימית דרך ה־backend container וגם חיצונית דרך `https://PUBLIC_HOST/health`

### מסמך הפעלה מלא

ראה: `docs/gitops-runbook.md`

### Troubleshooting קצר לפרודקשן

- `curl https://your-domain.co.il/health` מחזיר `Moved Permanently` דרך Cloudflare → בדוק שמצב `SSL/TLS` הוא `Full`/`Full (strict)` ולא `Flexible`.
- `curl -I https://your-domain.co.il/health` מחזיר `405` אבל `curl https://your-domain.co.il/health` מחזיר JSON → זה תקין, כי ה-endpoint מוגדר כ-`GET`.
- Traefik מחזיר `404` על `/`, `/api`, `/health` → בדוק שה-stack של `infra-proxy` רץ, שהרשת `traefik-public` קיימת, ושבלוגים של Traefik אין שגיאות Docker provider.
- `www-authenticate: Basic realm="traefik"` על הדומיין הראשי → ה-dashboard של Traefik יושב על אותו host של האפליקציה, ויש להעביר את `TRAEFIK_DASHBOARD_HOST` לסאב-דומיין אחר.

## הוספת מודול חדש

1. `backend/app/models/module_name.py` — מודל SQLAlchemy
2. `backend/app/schemas/module_name.py` — סכמות Pydantic
3. `backend/app/crud/module_name.py` — יורש `CRUDBase`
4. `backend/app/routers/module_name.py` — endpoints
5. `backend/app/main.py` — `app.include_router(...)`
6. `frontend/src/api/module_name.js` — קריאות API
7. `frontend/src/pages/ModuleName.jsx` — עמוד
8. `frontend/src/App.jsx` — הוסף Route + NavLink

## הרשאות

| פעולה              | agent | admin |
|--------------------|-------|-------|
| צפייה ברכבים       | ✅    | ✅    |
| יצירת הזמנה        | ✅    | ✅    |
| עריכת הזמנה שלו    | ✅    | ✅    |
| עריכת כל הזמנה     | ❌    | ✅    |
| הוספת רכב          | ❌    | ✅    |
| מחיקת הזמנה        | ❌    | ✅    |
| ניהול משתמשים      | ❌    | ✅    |

## משתני סביבה

| שם                          | תיאור                              | חובה |
|-----------------------------|------------------------------------|------|
| `DATABASE_URL`              | חיבור PostgreSQL                   | ✅   |
| `SECRET_KEY`                | מפתח JWT (32 bytes hex)            | ✅   |
| `FRONTEND_URL`              | URL ה-frontend לCORS               | ✅   |
| `PUBLIC_HOST`               | ה-host הציבורי שבו Traefik חושף את הפרויקט | ✅   |
| `RATE_LIMIT_BACKEND`        | `memory` או `redis`                | ❌   |
| `RATE_LIMIT_REDIS_URL`      | כתובת Redis (נדרש אם backend=redis) | ❌   |
| `RATE_LIMIT_REDIS_KEY_PREFIX` | prefix למפתחות rate-limit        | ❌   |
| `SUGGESTIONS_RATE_LIMIT_WINDOW_SECONDS` | חלון זמן ל-rate-limit      | ❌   |
| `EMAILS_ENABLED`            | הפעלת שליחת אימיילים               | ❌   |
| `SMTP_HOST/USER/PASSWORD`   | פרטי שרת SMTP                      | ❌   |
