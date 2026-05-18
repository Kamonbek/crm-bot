# Deployment

Two artifacts are deployed independently:

1. **Backend** (FastAPI + aiogram + scheduler) → **Google Cloud Run**.
2. **Frontend** (React SPA) → **GitHub Pages**.

Database (PostgreSQL) is hosted on **Supabase** or **Neon** free tier.

## Prerequisites

- Google Cloud project with billing enabled.
- `gcloud` CLI authenticated locally: `gcloud auth login` and `gcloud config set project <PROJECT_ID>`.
- Artifact Registry repository created (one-time):
  ```
  gcloud artifacts repositories create arabic-contact-bot \
    --repository-format=docker --location=europe-west1
  ```
- Database created on Supabase or Neon. Note the `DATABASE_URL` (must include `sslmode=require`).
- Telegram bot created via BotFather. Note the token and bot username.
- GitHub repository for the project, with Pages enabled (Source: GitHub Actions).

## Environment variables (backend)

Set these in Cloud Run (or via Secret Manager and reference them):

| Name | Description |
|---|---|
| `ENV` | `production` / `staging`. Controls docs exposure, log verbosity. |
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/db?ssl=true` |
| `TELEGRAM_BOT_TOKEN` | From BotFather. **Secret.** |
| `TELEGRAM_WEBHOOK_SECRET` | Random 32+ char string used in the URL path. **Secret.** |
| `TELEGRAM_WEBHOOK_HEADER_SECRET` | Random 32+ char string for the `X-Telegram-Bot-Api-Secret-Token` header. **Secret.** |
| `PUBLIC_BASE_URL` | Cloud Run service URL, e.g. `https://arabic-bot-xxxxx-ew.a.run.app`. |
| `BOT_USERNAME` | Bot username without `@`, used to build deep-link URLs. |
| `JWT_SECRET` | 64+ chars random. **Secret.** |
| `JWT_EXPIRES_MIN` | Default `60`. |
| `ADMIN_BOOTSTRAP_EMAIL` | Initial admin email. |
| `ADMIN_BOOTSTRAP_PASSWORD` | Initial admin password (rotated after first login). **Secret.** |
| `ADMIN_TEST_CHAT_ID` | Operator's Telegram chat id for material previews. |
| `CORS_ORIGINS` | Comma-separated list, e.g. `https://<user>.github.io`. |
| `SCHEDULER_POLL_SECONDS` | Default `15`. |
| `LOG_LEVEL` | Default `INFO`. |

Store every "Secret." item in **Google Secret Manager**, then reference from Cloud Run via `--set-secrets`.

## Backend: build & deploy

### 1. Dockerfile (in `backend/`)

The image must:

- Use `python:3.12-slim` base.
- Install dependencies via `uv` or `pip` from `pyproject.toml` / `requirements.txt`.
- Copy app source.
- Run as non-root user.
- Listen on the port provided by `$PORT` (Cloud Run sets this).
- `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]`.

### 2. Local build & push

```
PROJECT_ID=<gcp-project>
REGION=europe-west1
IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/arabic-contact-bot/api:$(git rev-parse --short HEAD)

gcloud builds submit backend/ --tag $IMAGE
```

### 3. Deploy to Cloud Run

```
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
  --timeout 60 \
  --set-env-vars ENV=production,PUBLIC_BASE_URL=https://<service-url>,BOT_USERNAME=<bot>,JWT_EXPIRES_MIN=60,SCHEDULER_POLL_SECONDS=15,LOG_LEVEL=INFO,CORS_ORIGINS=https://<user>.github.io \
  --set-secrets DATABASE_URL=db-url:latest,TELEGRAM_BOT_TOKEN=tg-token:latest,TELEGRAM_WEBHOOK_SECRET=tg-webhook:latest,TELEGRAM_WEBHOOK_HEADER_SECRET=tg-header:latest,JWT_SECRET=jwt-secret:latest,ADMIN_BOOTSTRAP_EMAIL=admin-email:latest,ADMIN_BOOTSTRAP_PASSWORD=admin-pass:latest,ADMIN_TEST_CHAT_ID=admin-chat:latest
```

Key choices:

- `--min-instances 1` keeps the scheduler loop alive between webhook bursts.
- `--max-instances 3` caps cost. Telegram webhooks are low-volume.
- `--concurrency 40` lets one instance handle many concurrent webhook calls thanks to asyncio.
- `--allow-unauthenticated` is required because Telegram cannot send IAM credentials; webhook auth is via the secret in the URL.

### 4. Run migrations

```
gcloud run jobs create arabic-bot-migrate \
  --image $IMAGE \
  --region $REGION \
  --set-secrets DATABASE_URL=db-url:latest \
  --command alembic --args upgrade,head

gcloud run jobs execute arabic-bot-migrate --region $REGION --wait
```

Re-run the job on every deploy that ships a new migration. CI runs it before `gcloud run deploy`.

### 5. Register the Telegram webhook

After the first successful deploy:

```
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<service-url>/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET>" \
  -d "secret_token=<TELEGRAM_WEBHOOK_HEADER_SECRET>" \
  -d 'allowed_updates=["message","callback_query","my_chat_member"]'
```

The backend also calls `setWebhook` on startup, which makes this curl optional after the first deploy.

Verify:

```
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

### 6. CI/CD (GitHub Actions)

`.github/workflows/backend-deploy.yml`:

- Trigger: push to `main` that touches `backend/**`.
- Steps:
  1. Checkout.
  2. Auth to GCP via Workload Identity Federation.
  3. `gcloud builds submit` to push image.
  4. Execute migration job.
  5. `gcloud run deploy` with the new image tag.

## Frontend: build & deploy

### 1. Vite config

- `base: '/arabic-contact-bot/'` (matches the GitHub Pages path).
- Env vars: `VITE_API_BASE_URL` (Cloud Run service URL).
- HashRouter is used so refreshes on deep links work without a custom 404.

### 2. Local build

```
cd frontend
npm ci
VITE_API_BASE_URL=https://<service-url> npm run build
```

Output ends up in `frontend/dist/`.

### 3. GitHub Pages via Actions

`.github/workflows/frontend-deploy.yml`:

- Trigger: push to `main` touching `frontend/**`.
- Steps:
  1. Checkout.
  2. `actions/setup-node@v4` with Node 20.
  3. `npm ci` in `frontend/`.
  4. `npm run build` with `VITE_API_BASE_URL` from repo secret.
  5. `actions/upload-pages-artifact@v3` for `frontend/dist`.
  6. `actions/deploy-pages@v4`.

In the repo settings: **Pages → Source = GitHub Actions**.

Custom domain (optional): add `frontend/public/CNAME` and a DNS record.

### 4. CORS

Make sure `CORS_ORIGINS` on the backend includes the final Pages URL (and the custom domain if configured).

## Database

### Supabase

- Project type: Postgres only (no auth, no storage required).
- In **Connection Pooling**, copy the **Session pooler** connection string for migrations and the **Transaction pooler** for the app — or use the direct connection string with asyncpg. Use `sslmode=require`.
- Disable email auth and RLS for non-public tables — we're talking to the DB only from the backend.

### Neon

- Create a project, copy the pooled URL.
- Append `?sslmode=require` if not already present.
- Note: Neon free tier auto-suspends; set `min-instances=1` on Cloud Run so the scheduler reconnects predictably, and tune `pool_pre_ping=True` in SQLAlchemy.

## Observability

- **Cloud Run logs**: structured JSON to stdout. Use Cloud Logging filters by `severity`, `labels.request_id`, `labels.telegram_update_id`.
- **Uptime check**: Google Cloud Monitoring uptime check on `/healthz`, alert on 3 consecutive failures.
- **Webhook health**: a cron-style task (or simple Cloud Scheduler → HTTP) calls `getWebhookInfo` daily; alerts if `pending_update_count` > threshold.

## Rollback

```
gcloud run services update-traffic arabic-bot \
  --region $REGION --to-revisions <previous-revision>=100
```

For frontend, redeploy a prior commit via the Actions UI ("Re-run jobs").

## Local development

- `cp .env.example .env` and fill in real values.
- Backend: `uvicorn app.main:app --reload --port 8080`.
- Telegram tunnel: use `ngrok http 8080`, then `setWebhook` to `https://<ngrok>/telegram/webhook/<secret>`. (Remember to revert webhook to the prod URL after.)
- Frontend: `npm run dev` → `http://localhost:5173`. `VITE_API_BASE_URL=http://localhost:8080`.
- DB: a local Docker Postgres (`postgres:15`) or a separate Supabase project for dev.
