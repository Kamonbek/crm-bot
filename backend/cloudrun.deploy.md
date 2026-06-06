# Cloud Run Deployment

Step-by-step commands to deploy the backend to Google Cloud Run.
Run every command from the **repo root** unless noted otherwise.

## Prerequisites

| Requirement | Notes |
|---|---|
| Google Cloud project with billing | Free tier works for low traffic |
| `gcloud` CLI installed and authenticated | `gcloud auth login && gcloud config set project PROJECT_ID` |
| Docker installed (for local builds) | Only needed if not using Cloud Build |
| Supabase project created | Copy the Transaction Pooler URL (port 6543) |
| Telegram bot created via @BotFather | Note the token and the bot `@username` |

---

## 1. One-time project setup

```bash
PROJECT_ID=your-gcp-project-id
REGION=europe-west1
SERVICE_NAME=arabic-bot
REPO_NAME=arabic-contact-bot

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --description="Arabic contact bot images"
```

---

## 2. Create secrets in Secret Manager

Never pass secrets as plain `--set-env-vars`. Store them in Secret Manager and
reference them with `--set-secrets`.

```bash
# Helper: create a secret and set its value interactively
create_secret() {
  gcloud secrets create "$1" --replication-policy=automatic
  printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=-
}

# Run once — replace placeholder values with real ones
create_secret arabic-bot-db-url \
  "postgresql+asyncpg://postgres.REF:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres"

create_secret arabic-bot-tg-token   "123456789:YOUR_BOT_TOKEN"
create_secret arabic-bot-tg-secret  "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
create_secret arabic-bot-jwt-secret "$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
create_secret arabic-bot-internal-key "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
```

Save the generated values somewhere safe — you will need
`arabic-bot-tg-secret` when registering the webhook (step 5).

---

## 3. Build and push the image

```bash
PROJECT_ID=your-gcp-project-id
REGION=europe-west1
REPO_NAME=arabic-contact-bot
SHORT_SHA=$(git rev-parse --short HEAD)
IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:$SHORT_SHA

# Build via Cloud Build (no local Docker required)
gcloud builds submit backend/ --tag $IMAGE

# Or build locally and push
# docker build -t $IMAGE backend/
# docker push $IMAGE
```

---

## 4. Run database migrations

Create a Cloud Run Job for migrations so they can be re-run safely on every
deploy without embedding migration logic in the server startup path.

```bash
# Create the job (one-time)
gcloud run jobs create arabic-bot-migrate \
  --image $IMAGE \
  --region $REGION \
  --set-secrets DATABASE_URL=arabic-bot-db-url:latest \
  --command alembic \
  --args "upgrade,head"

# Execute before every deploy that ships new migrations
gcloud run jobs execute arabic-bot-migrate --region $REGION --wait
```

---

## 5. Deploy the service

Replace `YOUR_GITHUB_USER` and `YOUR_REPO_NAME` with actual values.

```bash
GITHUB_PAGES_ORIGIN=https://YOUR_GITHUB_USER.github.io

gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 \
  --max-instances 3 \
  --concurrency 40 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 60 \
  --set-env-vars \
    ENV=production,\
    LOG_LEVEL=INFO,\
    FRONTEND_ORIGIN=$GITHUB_PAGES_ORIGIN,\
    JWT_EXPIRE_MINUTES=60,\
    SCHEDULER_MAX_MESSAGES=100,\
    DB_POOL_SIZE=2,\
    DB_MAX_OVERFLOW=3,\
    DB_POOL_RECYCLE=1800,\
    DB_POOL_PRE_PING=true \
  --set-secrets \
    DATABASE_URL=arabic-bot-db-url:latest,\
    TELEGRAM_BOT_TOKEN=arabic-bot-tg-token:latest,\
    TELEGRAM_WEBHOOK_SECRET=arabic-bot-tg-secret:latest,\
    JWT_SECRET=arabic-bot-jwt-secret:latest,\
    INTERNAL_API_KEY=arabic-bot-internal-key:latest
```

After deploy, note the service URL printed in the output — you need it in step 6.

```bash
# Retrieve the URL at any time
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION --format 'value(status.url)')
echo $SERVICE_URL
```

**Why `--min-instances 1`**: the scheduler poller and aiogram dispatcher are
in-process. Keeping one instance warm avoids cold-start latency on webhook
calls and ensures scheduled messages fire close to their target time.

**Why `--allow-unauthenticated`**: Telegram cannot attach GCP IAM credentials.
The webhook endpoint is protected by the `X-Telegram-Bot-Api-Secret-Token`
header instead (set via `TELEGRAM_WEBHOOK_SECRET`).

---

## 6. Register the Telegram webhook

Run this once after the first successful deploy, and again whenever the service
URL or the webhook secret changes.

```bash
BOT_TOKEN="<value of arabic-bot-tg-token secret>"
WEBHOOK_SECRET="<value of arabic-bot-tg-secret secret>"
SERVICE_URL="https://arabic-bot-xxxxx-ew.a.run.app"   # from step 5

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${SERVICE_URL}/webhook/telegram\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"callback_query\", \"my_chat_member\"]
  }" | python3 -m json.tool
```

Verify the registration:

```bash
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" \
  | python3 -m json.tool
```

Expected output includes `"url": "https://...arabic-bot.../webhook/telegram"` and
`"pending_update_count": 0`.

---

## 7. Create the initial admin account

```bash
# Open a one-off Cloud Run task with the service's secrets injected
gcloud run jobs create arabic-bot-create-admin \
  --image $IMAGE \
  --region $REGION \
  --set-secrets \
    DATABASE_URL=arabic-bot-db-url:latest \
  --command python \
  --args "-m,app.cli,create-admin,--email,admin@example.com,--password,CHANGE_ME"

gcloud run jobs execute arabic-bot-create-admin --region $REGION --wait

# Delete the job immediately — it contains a plain-text password in --args
gcloud run jobs delete arabic-bot-create-admin --region $REGION --quiet
```

Change the password from the admin panel after first login.

---

## 8. Set up the scheduler

Cloud Scheduler calls `POST /internal/process-scheduled` on a cron schedule to
dispatch due messages. This requires no extra runtime cost — it is a plain HTTP
call to the already-running service.

```bash
INTERNAL_KEY="<value of arabic-bot-internal-key secret>"

gcloud scheduler jobs create http arabic-bot-scheduler \
  --location $REGION \
  --schedule "* * * * *" \
  --uri "${SERVICE_URL}/internal/process-scheduled" \
  --message-body "" \
  --headers "X-Internal-Api-Key=${INTERNAL_KEY},Content-Type=application/json" \
  --http-method POST \
  --attempt-deadline 30s \
  --time-zone "UTC"
```

The scheduler fires every minute. Each run processes up to
`SCHEDULER_MAX_MESSAGES` (default 100) due messages.

---

## 9. Subsequent deploys

```bash
SHORT_SHA=$(git rev-parse --short HEAD)
IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:$SHORT_SHA

gcloud builds submit backend/ --tag $IMAGE
gcloud run jobs execute arabic-bot-migrate --region $REGION --wait
gcloud run deploy $SERVICE_NAME --image $IMAGE --region $REGION
```

---

## Rollback

```bash
# List recent revisions
gcloud run revisions list --service $SERVICE_NAME --region $REGION

# Shift 100 % of traffic to a specific revision
gcloud run services update-traffic $SERVICE_NAME \
  --region $REGION \
  --to-revisions arabic-bot-00042-xyz=100
```

---

## Grant Cloud Run access to secrets (if permission errors occur)

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in arabic-bot-db-url arabic-bot-tg-token arabic-bot-tg-secret \
              arabic-bot-jwt-secret arabic-bot-internal-key; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```
