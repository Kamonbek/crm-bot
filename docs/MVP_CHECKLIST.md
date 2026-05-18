# MVP Checklist

## Security checklist

### Secrets

- [ ] `TELEGRAM_BOT_TOKEN` only present in backend env (never in frontend, never in repo).
- [ ] `JWT_SECRET` is ≥64 chars, random, stored in Secret Manager.
- [ ] `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_WEBHOOK_HEADER_SECRET` are random ≥32 chars and rotated if leaked.
- [ ] `ADMIN_BOOTSTRAP_PASSWORD` is forced to be changed after first login (or removed from env after the bootstrap admin exists).
- [ ] `.env` is gitignored. `.env.example` contains only placeholder values.
- [ ] Pre-commit hook (or CI check) scans for secrets with a tool like `gitleaks`.

### Webhook

- [ ] Webhook URL contains the long random `TELEGRAM_WEBHOOK_SECRET`; mismatch returns **404**, not 401, to avoid existence leak.
- [ ] `X-Telegram-Bot-Api-Secret-Token` header is verified as defense in depth.
- [ ] Webhook always returns 200 to Telegram to suppress redelivery; errors are logged internally.

### Auth

- [ ] All `/api/v1/*` endpoints except `POST /api/v1/auth/login` require a valid JWT.
- [ ] Passwords stored as bcrypt with cost factor ≥12.
- [ ] JWTs have an `exp` claim and are short-lived (≤60 min).
- [ ] Logout endpoint exists for client symmetry (token discard on the client).
- [ ] Login is rate-limited (per-IP, per-email).

### CORS & headers

- [ ] `CORS_ORIGINS` is a strict allowlist (Pages URL + localhost dev). No `*`.
- [ ] Security headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.
- [ ] `/docs` and `/redoc` disabled when `ENV=production`.

### Data handling

- [ ] All DB queries use parameter binding (SQLAlchemy core/ORM — never string interpolation).
- [ ] User-provided text in materials is sent to Telegram with the explicit `parse_mode` chosen by the operator; if `MarkdownV2`, the rendering pipeline escapes appropriately.
- [ ] Broadcasts require a server-side **preview** count before being scheduled; UI requires confirmation modal before dispatch.
- [ ] Soft deletes for `users` and `materials` so audit trail is preserved.
- [ ] PII (phone, names) is not logged in plaintext; logs use user_id rather than personal fields.

### Infrastructure

- [ ] Cloud Run service runs as a non-root container user.
- [ ] DB connection uses TLS (`sslmode=require`).
- [ ] Secret Manager IAM grants the runtime service account read-only access to only the needed secrets.
- [ ] Backups: rely on Supabase/Neon daily snapshots; verify retention.
- [ ] No direct DB exposure to the public internet beyond what Supabase/Neon already restricts.

## Testing checklist

### Unit (backend)

- [ ] `services.campaigns.find_by_code` returns None for unknown / inactive codes.
- [ ] `services.automations.enroll` materializes one `scheduled_message` per step with correct `send_at`.
- [ ] `services.automations.cancel` flips only `pending` rows to `cancelled`.
- [ ] `services.delivery.send` handles forbidden / bad-request / retry-after / generic errors per spec.
- [ ] `services.segments.resolve` correctly applies tags/source/last_seen filters.
- [ ] `core.security`: JWT issue/verify round-trip; expired tokens rejected; bcrypt verify.
- [ ] `core.deeplinks`: encode/decode is reversible and URL-safe.
- [ ] Scheduler `SKIP LOCKED` query returns disjoint rows under simulated concurrency.

### Integration (backend)

- [ ] Webhook with valid `/start <code>` registers user, joins campaign, enrolls in automation, schedules messages.
- [ ] Webhook with invalid `<code>` registers user, logs event, sends generic welcome.
- [ ] Webhook with wrong path secret returns 404.
- [ ] Webhook with wrong header secret returns 403.
- [ ] `POST /api/v1/auth/login` returns JWT for valid creds; 401 otherwise; rate-limited after N tries.
- [ ] `POST /api/v1/campaigns` returns a campaign with a unique `code` and well-formed `deep_link_url`.
- [ ] `POST /api/v1/broadcasts/{id}/schedule` writes the expected number of `scheduled_messages` and `broadcast_targets`.
- [ ] `POST /api/v1/scheduled-messages/{id}/cancel` rejects non-pending statuses.
- [ ] Soft-delete cascade: deleting a campaign with users keeps `user_campaigns` and `users`.

### Scheduler

- [ ] Pending message past `send_at` is sent within `2 × SCHEDULER_POLL_SECONDS`.
- [ ] On 429 from Telegram, the message is retried after `retry_after` seconds; not duplicated.
- [ ] On 403 from Telegram, user `is_blocked` is set, message is `failed_terminal`, event logged.
- [ ] On transient error, retry with exponential backoff up to `max_attempts`.
- [ ] Concurrent scheduler instances do not double-send (idempotency_key + SKIP LOCKED).

### Frontend

- [ ] Auth: login persists JWT; `ProtectedRoute` redirects unauthenticated users; expired tokens trigger redirect.
- [ ] Campaigns: create, copy deep-link URL to clipboard, view stats.
- [ ] Materials: create text/photo/document/link; preview send to operator chat works.
- [ ] Automations: define steps, reorder, activate/deactivate, enroll a test user.
- [ ] Broadcasts: select segment, see live recipient preview, schedule with confirmation modal, see progress.
- [ ] Users: search, paginate, view per-user delivery/event timeline.
- [ ] Logs: filterable delivery + event views with pagination.

### End-to-end

- [ ] Fresh user clicks deep-link → receives welcome → receives automation step 1 at expected delay → step 2 at expected delay.
- [ ] Blocking the bot stops further deliveries and surfaces `is_blocked` in the admin UI.
- [ ] Broadcast to a segment of N users results in N rows in `delivery_logs` with appropriate `status` distribution.

### Performance / load (light)

- [ ] 100 concurrent webhook updates do not drop messages.
- [ ] Sending a 1000-recipient broadcast completes within Telegram's rate limit window without 429 cascades.

## Implementation milestones

### M0 — Bootstrap (½ day)
- [ ] Initialize backend + frontend skeletons.
- [ ] Dockerfile, alembic config, FastAPI app factory, basic `/healthz`.
- [ ] Frontend Vite skeleton with Tailwind, routes, login screen stub.
- [ ] `.env.example` and CI lint workflow.

### M1 — Auth & DB (1 day)
- [ ] Alembic initial migration: every table from `DATABASE_SCHEMA.md`.
- [ ] `admin_users` + bootstrap admin on startup.
- [ ] `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, JWT plumbing.
- [ ] Frontend login flow with TanStack Query.

### M2 — Telegram webhook & user registration (1 day)
- [ ] aiogram Bot/Dispatcher; FastAPI webhook route with path + header secret verification.
- [ ] `UserRegistrationMiddleware`, `EventLoggingMiddleware`.
- [ ] `/start` handler (no deep-link yet) sends static welcome.
- [ ] `setWebhook` on startup; `getWebhookInfo` healthcheck.

### M3 — Campaigns & deep-links (1 day)
- [ ] Campaigns CRUD API + UI.
- [ ] `core.deeplinks` encode/decode.
- [ ] `/start <code>` enriched flow: insert `user_campaigns`, set `source_campaign_id`, emit `campaign.joined`.

### M4 — Materials (½ day)
- [ ] Materials CRUD API + UI.
- [ ] `POST /api/v1/materials/{id}/preview` sends to `ADMIN_TEST_CHAT_ID`.
- [ ] Material rendering helper that maps `kind` → aiogram send method.

### M5 — Automations & scheduler (1.5 days)
- [ ] Automations CRUD + steps editor in UI.
- [ ] `services.automations.enroll` materializes `scheduled_messages`.
- [ ] Scheduler loop with `SKIP LOCKED`, retries, backoff.
- [ ] Wire `/start <code>` to auto-enroll on `campaign.automation_id`.

### M6 — Segments & broadcasts (1 day)
- [ ] Segments CRUD + filter DSL (`services.segments.resolve`).
- [ ] Broadcast compose UI with **preview** + confirmation modal.
- [ ] `POST /broadcasts/{id}/schedule` materializes targets and scheduled messages.
- [ ] Cancel-broadcast endpoint and progress display.

### M7 — Logs, dashboard, polish (1 day)
- [ ] Delivery and event log APIs + filtered tables.
- [ ] `/api/v1/stats/overview` and dashboard widgets.
- [ ] Per-user timeline page.
- [ ] Error toasts, empty states, loading states across UI.

### M8 — Deploy (½ day)
- [ ] Deploy backend to Cloud Run (production env, Secret Manager wired).
- [ ] Run Alembic migration job against prod DB.
- [ ] Configure webhook to point at production URL.
- [ ] Deploy frontend to GitHub Pages with prod `VITE_API_BASE_URL`.
- [ ] Smoke test: create campaign → click deep-link → automation fires → broadcast a test segment.

### M9 — Hardening (½ day)
- [ ] Uptime check + alerting on `/healthz` and webhook backlog.
- [ ] Rate limiting on login.
- [ ] Security header middleware.
- [ ] Final pass against this checklist.

**Estimated MVP scope**: ~8 working days for a single developer.
