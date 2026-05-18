# API Specification

All endpoints are served by the single FastAPI app on Cloud Run.

- Base URL (prod): `https://<service>-<hash>-<region>.a.run.app`
- Base path for admin REST API: `/api/v1`
- Telegram webhook: `/telegram/webhook/{secret}`
- Health: `/healthz`, `/readyz`

## Conventions

- Content type: `application/json; charset=utf-8`.
- Timestamps: ISO 8601 UTC (`2026-05-18T10:30:00Z`).
- Pagination: cursor-based via `?limit=&cursor=` on list endpoints. Default `limit=50`, max `200`. Response includes `next_cursor` (or `null`).
- Errors are uniform:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable message.",
    "details": { "field": "..." }
  }
}
```

| HTTP | `error.code` examples |
|---|---|
| 400 | `validation_error`, `invalid_state` |
| 401 | `unauthenticated` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `conflict`, `duplicate` |
| 422 | `unprocessable` |
| 429 | `rate_limited` |
| 500 | `internal_error` |

- Auth: `Authorization: Bearer <jwt>` on every `/api/v1/*` endpoint except `POST /api/v1/auth/login`.
- CORS: only the configured GitHub Pages origin and `http://localhost:5173` (dev) are allowed.

## Health

### `GET /healthz`
- 200 `{"status":"ok"}`. Liveness only.

### `GET /readyz`
- 200 if DB is reachable, else 503.

## Auth

### `POST /api/v1/auth/login`
- Body: `{ "email": "...", "password": "..." }`
- 200: `{ "access_token": "...", "token_type": "bearer", "expires_in": 3600, "admin": { "id": 1, "email": "..." } }`
- 401 on invalid credentials.

### `GET /api/v1/auth/me`
- 200: `{ "id", "email", "is_active", "last_login_at" }`.

### `POST /api/v1/auth/logout`
- 204. (Stateless JWT — client just discards the token. Endpoint exists for symmetry and future blocklist.)

## Users (Telegram contacts)

### `GET /api/v1/users`
- Query: `q` (search by name/username/phone), `tag`, `source_campaign_id`, `is_blocked`, `limit`, `cursor`.
- 200: `{ "items": [User], "next_cursor": "..." }`.

### `GET /api/v1/users/{id}`
- 200: `User` including derived `campaigns`, `active_enrollments`, `tags`.

### `PATCH /api/v1/users/{id}`
- Body (any subset): `{ "tags": [...], "level": "...", "phone": "..." }`.
- 200: updated `User`.

### `GET /api/v1/users/{id}/events`
- 200: `{ "items": [EventLog], "next_cursor": "..." }`.

### `GET /api/v1/users/{id}/deliveries`
- 200: `{ "items": [DeliveryLog], "next_cursor": "..." }`.

### `POST /api/v1/users/{id}/send`
Send a material to one user, immediately or at `send_at`.

- Body: `{ "material_id": 123, "send_at": "..."|null }`.
- 202: `{ "scheduled_message_id": 456 }`.

## Campaigns

### `GET /api/v1/campaigns`
- Query: `is_active`, `limit`, `cursor`.

### `POST /api/v1/campaigns`
- Body: `{ "name", "description", "welcome_material_id"?, "automation_id"? }`.
- 201: `Campaign` including `code` and `deep_link_url = https://t.me/<bot_username>?start=<code>`.

### `GET /api/v1/campaigns/{id}`
- 200: `Campaign` with stats: `total_users`, `users_last_7d`, `users_last_30d`.

### `PATCH /api/v1/campaigns/{id}`
- Body: any of `name`, `description`, `welcome_material_id`, `automation_id`, `is_active`.

### `DELETE /api/v1/campaigns/{id}`
- 204. Soft delete via `is_active=false` if referenced; hard delete only if no users reference it.

## Materials

### `GET /api/v1/materials`
- Query: `kind`, `q`, `limit`, `cursor`.

### `POST /api/v1/materials`
- Body: `{ "name", "kind", "body"?, "file_id"?, "file_url"?, "link_url"?, "parse_mode"?, "disable_web_page_preview"? }`.
- 201: `Material`.

### `GET /api/v1/materials/{id}`
### `PATCH /api/v1/materials/{id}`
### `DELETE /api/v1/materials/{id}`
- Soft delete; rejected with 409 if referenced by an active automation or pending scheduled message.

### `POST /api/v1/materials/{id}/preview`
- Body: `{ "telegram_id_or_username"?: "..." }` — sends to a designated test chat (operator's own Telegram). If omitted, falls back to `ADMIN_TEST_CHAT_ID`.
- 202: `{ "delivery_log_id": ... }`.

## Automations

### `GET /api/v1/automations`
### `POST /api/v1/automations`
- Body: `{ "name", "description", "trigger_kind": "campaign_join"|"manual"|"tag_added", "steps": [{ "position", "delay_minutes", "material_id" }] }`.

### `GET /api/v1/automations/{id}`
### `PATCH /api/v1/automations/{id}`
- Body may include reordered/edited `steps`. Replacing steps requires `is_active=false`.

### `POST /api/v1/automations/{id}/activate`
### `POST /api/v1/automations/{id}/deactivate`

### `POST /api/v1/automations/{id}/enroll`
- Body: `{ "user_id": 123 }` or `{ "segment_id": 4 }`.
- 202: `{ "enrolled": N, "enrollment_ids": [...] }`.

### `POST /api/v1/automations/{id}/cancel-enrollment`
- Body: `{ "user_id": 123 }`.
- 204.

## Broadcasts

### `GET /api/v1/broadcasts`
- Query: `status`, `limit`, `cursor`.

### `POST /api/v1/broadcasts`
- Body: `{ "name", "material_id", "segment_id"?, "scheduled_at"?: ISO|null }`.
- Creates a `broadcast` in `draft`.
- 201: `Broadcast`.

### `GET /api/v1/broadcasts/{id}/preview`
- 200: `{ "recipient_count": 1234, "sample_users": [User(5)], "material": Material }`.
- Recomputes recipients from `segment_id` (does not persist).

### `POST /api/v1/broadcasts/{id}/schedule`
- Body: `{ "scheduled_at": "..."|"now" }`.
- Server resolves the segment, writes `broadcast_targets`, writes `scheduled_messages`, sets `status` to `scheduled` or `sending`.
- 202: `{ "recipient_count": N }`.
- 409 if not in `draft`.

### `POST /api/v1/broadcasts/{id}/cancel`
- 204. Cancels any `pending` scheduled messages attached to this broadcast.

### `GET /api/v1/broadcasts/{id}`
- 200: `Broadcast` with counts and progress.

## Scheduled messages

### `GET /api/v1/scheduled-messages`
- Query: `status`, `user_id`, `source_kind`, `from`, `to`, `limit`, `cursor`.

### `POST /api/v1/scheduled-messages`
Ad-hoc operator-scheduled send.
- Body: `{ "user_id", "material_id", "send_at" }`.
- 201: `ScheduledMessage`.

### `POST /api/v1/scheduled-messages/{id}/cancel`
- 204. Only allowed in `pending`.

## Segments

### `GET /api/v1/segments`
### `POST /api/v1/segments`
- Body: `{ "name", "description", "filter": SegmentFilter }`.
- `SegmentFilter` shape:

```json
{
  "tags_any": ["beginner"],
  "tags_all": ["paid"],
  "language_code": ["ar","en"],
  "source_campaign_ids": [1,2],
  "last_seen": { "gte": "2026-04-01", "lte": null },
  "enrolled_in_automation_id": 3,
  "is_blocked": false
}
```

### `GET /api/v1/segments/{id}`
### `PATCH /api/v1/segments/{id}`
### `DELETE /api/v1/segments/{id}`
### `POST /api/v1/segments/{id}/preview`
- 200: `{ "count": N, "sample_users": [User(10)] }`.

## Logs

### `GET /api/v1/logs/delivery`
- Query: `user_id`, `status`, `material_id`, `from`, `to`, `limit`, `cursor`.

### `GET /api/v1/logs/events`
- Query: `kind`, `user_id`, `from`, `to`, `limit`, `cursor`.

## Stats (Dashboard)

### `GET /api/v1/stats/overview`
- 200:
```json
{
  "users": { "total": 1234, "new_today": 12, "new_7d": 90, "blocked": 7 },
  "scheduled": { "pending": 50, "due_next_hour": 3 },
  "broadcasts": { "sent_7d": 4, "scheduled": 1 },
  "delivery_7d": { "sent": 800, "failed": 5, "success_rate": 0.9938 }
}
```

### `GET /api/v1/stats/campaigns`
- 200: `[{ "campaign_id", "name", "users_total", "users_7d" }]`.

## Telegram webhook

### `POST /telegram/webhook/{secret}`
- `{secret}` must match `TELEGRAM_WEBHOOK_SECRET`. Mismatch → 404 (do not leak existence).
- Optional defense in depth: also verify the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_HEADER_SECRET`.
- Body: raw Telegram `Update` JSON.
- 200 always (errors are logged; never echo to Telegram).

## OpenAPI

FastAPI auto-generates `/openapi.json` and serves `/docs` (Swagger UI) and `/redoc`. In production these are disabled unless `ENV=staging`.

## Schemas (illustrative)

```ts
type User = {
  id: number;
  telegram_id: number;
  chat_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  phone: string | null;
  level: string | null;
  tags: string[];
  is_blocked: boolean;
  source_campaign_id: number | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

type Campaign = {
  id: number;
  name: string;
  code: string;
  deep_link_url: string;
  description: string | null;
  welcome_material_id: number | null;
  automation_id: number | null;
  is_active: boolean;
  stats?: { total_users: number; users_7d: number; users_30d: number };
};

type Material = {
  id: number;
  name: string;
  kind: "text" | "photo" | "document" | "video" | "link";
  body: string | null;
  file_id: string | null;
  file_url: string | null;
  link_url: string | null;
  parse_mode: "MarkdownV2" | "HTML" | "none";
  disable_web_page_preview: boolean;
};

type Automation = {
  id: number;
  name: string;
  description: string | null;
  trigger_kind: "campaign_join" | "manual" | "tag_added";
  is_active: boolean;
  steps: { id: number; position: number; delay_minutes: number; material_id: number }[];
};

type ScheduledMessage = {
  id: number;
  user_id: number;
  material_id: number;
  source_kind: "automation" | "broadcast" | "manual";
  source_id: number | null;
  send_at: string;
  status: "pending" | "processing" | "sent" | "failed" | "failed_terminal" | "cancelled";
  attempts: number;
  last_error: string | null;
};

type Broadcast = {
  id: number;
  name: string;
  material_id: number;
  segment_id: number | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  recipient_count: number;
  success_count: number;
  failure_count: number;
};

type DeliveryLog = {
  id: number;
  user_id: number;
  material_id: number;
  scheduled_message_id: number | null;
  status: "sent" | "failed";
  telegram_message_id: number | null;
  error_code: string | null;
  sent_at: string;
};

type EventLog = {
  id: number;
  user_id: number | null;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
};
```
