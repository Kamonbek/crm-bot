# Deployment

Two artifacts are deployed independently:

| Artifact | Target |
|---|---|
| **Backend** (FastAPI + aiogram) | Google Cloud Run |
| **Frontend** (React SPA) | GitHub Pages (via GitHub Actions) |
| **Database** | Supabase PostgreSQL (free tier) |

For full step-by-step Cloud Run commands see
[`backend/cloudrun.deploy.md`](../backend/cloudrun.deploy.md).

---

## Environment variables — backend

Set non-secret vars via `--set-env-vars` and secret vars via `--set-secrets`
(Google Secret Manager). **Never commit secrets or pass them as plain env vars
in CI logs.**

| Variable | Required | Description |
|---|---|---|
| `ENV` | Yes | `production` / `staging` / `development`. Controls docs exposure and log verbosity. |
| `DATABASE_URL` | Yes | Supabase Transaction Pooler URL (port 6543). `postgresql+asyncpg://postgres.REF:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres`. **Secret.** |
| `TELEGRAM_BOT_TOKEN` | Yes | From @BotFather. **Secret.** |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | 32+ char random string sent by Telegram in `X-Telegram-Bot-Api-Secret-Token` header. **Secret.** |
| `JWT_SECRET` | Yes | 48+ char random string for signing admin JWTs. **Secret.** |
| `INTERNAL_API_KEY` | Yes | Shared secret for `POST /internal/process-scheduled`. **Secret.** |
| `FRONTEND_ORIGIN` | Yes | GitHub Pages URL, e.g. `https://USER.github.io`. Comma-separate multiple origins. |
| `LOG_LEVEL` | No | Default `INFO`. |
| `JWT_EXPIRE_MINUTES` | No | Default `60`. |
| `SCHEDULER_MAX_MESSAGES` | No | Max messages per scheduler run. Default `100`. |
| `DB_POOL_SIZE` | No | Per-instance pool connections. Default `2`. |
| `DB_MAX_OVERFLOW` | No | Burst connections above pool size. Default `3`. |
| `DB_POOL_RECYCLE` | No | Recycle idle connections after N seconds. Default `1800`. |
| `DB_POOL_PRE_PING` | No | Detect stale connections on checkout. Default `true`. |

### Secret Manager — recommended setup

```bash
# Create each secret once:
printf '%s' "$VALUE" | gcloud secrets create SECRET_NAME --data-file=-

# Reference from Cloud Run:
--set-secrets DATABASE_URL=arabic-bot-db-url:latest,\
              TELEGRAM_BOT_TOKEN=arabic-bot-tg-token:latest,\
              TELEGRAM_WEBHOOK_SECRET=arabic-bot-tg-secret:latest,\
              JWT_SECRET=arabic-bot-jwt-secret:latest,\
              INTERNAL_API_KEY=arabic-bot-internal-key:latest
```

---

## Backend: build & deploy

### Dockerfile

- Base: `python:3.13-slim`
- Runs as non-root (`appuser`, uid 1000)
- Listens on `$PORT` (Cloud Run injects this; defaults to `8080`)
- CMD: `exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}`

### Build

```bash
PROJECT_ID=your-gcp-project
REGION=europe-west1
SHORT_SHA=$(git rev-parse --short HEAD)
IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/arabic-contact-bot/api:$SHORT_SHA

gcloud builds submit backend/ --tag $IMAGE
```

### Migrate

```bash
gcloud run jobs execute arabic-bot-migrate --region $REGION --wait
```

Run before every deploy that ships new Alembic migrations. See
`cloudrun.deploy.md` for the one-time job creation command.

### Deploy

```bash
gcloud run deploy arabic-bot \
  --image $IMAGE \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 \
  --max-instances 3 \
  --concurrency 40 \
  --cpu 1 --memory 512Mi \
  --set-env-vars ENV=production,FRONTEND_ORIGIN=https://USER.github.io \
  --set-secrets DATABASE_URL=arabic-bot-db-url:latest,...
```

`--min-instances 1` keeps the in-process scheduler warm and avoids cold-start
latency on Telegram webhook bursts.

`--allow-unauthenticated` is required because Telegram cannot attach GCP IAM
credentials. The webhook is protected instead by `TELEGRAM_WEBHOOK_SECRET`.

### Register the Telegram webhook

Run once after first deploy, and again whenever the service URL changes:

```bash
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${SERVICE_URL}/webhook/telegram\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"callback_query\", \"my_chat_member\"]
  }"

# Verify
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### Set up the message scheduler

Cloud Scheduler calls the internal endpoint every minute:

```bash
gcloud scheduler jobs create http arabic-bot-scheduler \
  --location $REGION \
  --schedule "* * * * *" \
  --uri "${SERVICE_URL}/internal/process-scheduled" \
  --message-body "" \
  --headers "X-Internal-Api-Key=${INTERNAL_API_KEY},Content-Type=application/json" \
  --http-method POST \
  --attempt-deadline 30s \
  --time-zone UTC
```

### Create initial admin

```bash
python -m app.cli create-admin --email admin@example.com --password CHANGE_ME
# Run this against the production DB via a one-off Cloud Run job.
# See cloudrun.deploy.md step 7 for the exact gcloud commands.
```

---

## Frontend: build & deploy

### Vite configuration

- `base` is read from `VITE_BASE_PATH` env var (defaults to `/`).
- Set `VITE_BASE_PATH=/your-repo-name/` for a GitHub project page.
- Set `VITE_BASE_PATH=/` when using a custom domain on Pages.
- Hash routing (`createHashRouter`) means no server-side redirect config needed.

### Environment variables — frontend

| Variable | Where to set | Description |
|---|---|---|
| `VITE_API_BASE_URL` | GitHub repo variable | Cloud Run service URL, no trailing slash. E.g. `https://arabic-bot-xxxxx-ew.a.run.app` |
| `VITE_BASE_PATH` | GitHub repo variable | `/` for custom domain, `/repo-name/` for project page |

Set these in **GitHub → repo → Settings → Secrets and variables → Actions →
Variables** (not Secrets — they are not sensitive).

### GitHub Actions

`.github/workflows/frontend.yml` triggers on push to `main` that touches
`frontend/**`. Steps:

1. `actions/setup-node@v4` — Node 20, npm cache keyed on `frontend/package-lock.json`
2. `npm ci` — deterministic install from lockfile
3. `npm run build` — Vite build with env vars injected
4. `actions/upload-pages-artifact@v3` — uploads `frontend/dist`
5. `actions/deploy-pages@v4` — publishes to GitHub Pages

**One-time repo setup:** GitHub → Settings → Pages → Source = **GitHub Actions**.

### Local build

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: set VITE_API_BASE_URL=http://localhost:8080
npm ci
npm run dev       # development server at http://localhost:5173
npm run build     # production build → frontend/dist/
```

---

## Database (Supabase)

1. Create a Supabase project (Postgres only — no auth or storage needed).
2. Dashboard → Settings → Database → Connection string → **Transaction pooler
   (port 6543)** → URI tab.
3. Replace `postgresql://` with `postgresql+asyncpg://`.
4. Store as `arabic-bot-db-url` in Secret Manager.

**Connection limits** — with `DB_POOL_SIZE=2` and `DB_MAX_OVERFLOW=3`, each
Cloud Run instance holds ≤ 5 connections. With `--max-instances 3` the total
peak is 15, well within Supabase free-tier (100 direct / unlimited pooler).

**Migrations** — always run `alembic upgrade head` before deploying a new
revision that adds migrations.

**Never** use the Supabase `anon` or `service_role` keys for database access.
**Never** expose `DATABASE_URL` to the frontend.

---

## Observability

- **Logs**: structured JSON to stdout → Cloud Logging. Filter by
  `jsonPayload.request_id` or `jsonPayload.level`.
- **Uptime check**: Cloud Monitoring → Uptime checks → `GET /healthz`. Alert on
  3 consecutive failures.
- **Webhook health**: periodically run `getWebhookInfo` and alert if
  `pending_update_count` grows.

---

## Rollback

```bash
# Backend: shift traffic to a previous revision
gcloud run services update-traffic arabic-bot \
  --region $REGION \
  --to-revisions arabic-bot-00042-abc=100

# Frontend: re-run the workflow on a prior commit via GitHub Actions UI
```
