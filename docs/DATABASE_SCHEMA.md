# Database Schema

PostgreSQL 15+. All tables use:

- `id BIGSERIAL PRIMARY KEY` (unless noted).
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` (updated by trigger or in the service layer).
- Foreign keys are `ON DELETE RESTRICT` unless explicitly stated. We prefer soft deletes (`deleted_at`) where business data must remain auditable.

Naming convention for Alembic-generated constraints:

- `pk_<table>`, `fk_<table>_<column>_<reftable>`, `ix_<table>_<column>`, `uq_<table>_<column>`, `ck_<table>_<name>`.

## Entity overview

| Table | Purpose |
|---|---|
| `admin_users` | Operators who can log into the dashboard. |
| `users` | End users (Telegram contacts). One row per Telegram chat. |
| `campaigns` | Acquisition campaigns; each has a unique deep-link code. |
| `user_campaigns` | Join: which users came in through which campaigns. |
| `materials` | Reusable content blocks (text / file / link). |
| `automations` | Named automation sequences. |
| `automation_steps` | Ordered steps inside an automation. |
| `automation_enrollments` | A user's run through an automation. |
| `scheduled_messages` | Queue of outbound messages with `send_at`. |
| `broadcasts` | Operator-composed mass messages. |
| `broadcast_targets` | Snapshot of recipients for a given broadcast. |
| `segments` | Saved filter definitions for targeting. |
| `delivery_logs` | One row per Telegram send attempt. |
| `event_logs` | Append-only stream of system events. |

## Tables

### `admin_users`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `email` | TEXT NOT NULL UNIQUE | citext-equivalent (lowercased on write) |
| `password_hash` | TEXT NOT NULL | bcrypt |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | |
| `last_login_at` | TIMESTAMPTZ | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Indexes: `uq_admin_users_email`.

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | Internal id. |
| `telegram_id` | BIGINT NOT NULL UNIQUE | Telegram user id (`from.id`). |
| `chat_id` | BIGINT NOT NULL | Private chat id (== telegram_id for DMs). |
| `username` | TEXT | Nullable; Telegram allows null. |
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `language_code` | TEXT | Reported by Telegram. |
| `phone` | TEXT | Set if user shares contact. |
| `level` | TEXT | Optional self-reported Arabic level. |
| `source_campaign_id` | BIGINT FK → `campaigns.id` | First-touch campaign. Nullable. |
| `is_blocked` | BOOLEAN NOT NULL DEFAULT FALSE | True if Telegram returned 403 on send. |
| `tags` | TEXT[] NOT NULL DEFAULT '{}' | Free-form labels for segmentation. |
| `last_seen_at` | TIMESTAMPTZ | Last inbound update. |
| `created_at`, `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | Soft delete. |

Indexes: `uq_users_telegram_id`, `ix_users_chat_id`, `ix_users_source_campaign_id`, `ix_users_is_blocked`, GIN on `tags`.

### `campaigns`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `name` | TEXT NOT NULL | Operator-facing label. |
| `code` | TEXT NOT NULL UNIQUE | URL-safe deep-link code. Generated server-side. |
| `description` | TEXT | |
| `welcome_material_id` | BIGINT FK → `materials.id` | Optional first-message override. |
| `automation_id` | BIGINT FK → `automations.id` | Optional automation to enroll new users into. |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Indexes: `uq_campaigns_code`, `ix_campaigns_is_active`.

### `user_campaigns`

Many-to-many. A user may arrive via multiple campaigns over time.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `user_id` | BIGINT FK → `users.id` ON DELETE CASCADE | |
| `campaign_id` | BIGINT FK → `campaigns.id` ON DELETE RESTRICT | |
| `entered_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Indexes: `uq_user_campaigns_user_campaign` (`user_id`, `campaign_id`), `ix_user_campaigns_campaign_id`.

### `materials`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `name` | TEXT NOT NULL | Internal label. |
| `kind` | TEXT NOT NULL | `text`, `photo`, `document`, `video`, `link`. CHECK constraint. |
| `body` | TEXT | Text body or caption. Supports Telegram MarkdownV2. |
| `file_id` | TEXT | Cached Telegram `file_id` for re-sends. |
| `file_url` | TEXT | Source URL if uploaded via URL. |
| `link_url` | TEXT | For `kind='link'`. |
| `parse_mode` | TEXT NOT NULL DEFAULT 'MarkdownV2' | `MarkdownV2`, `HTML`, or `none`. |
| `disable_web_page_preview` | BOOLEAN NOT NULL DEFAULT FALSE | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | Soft delete. |

CHECK: `kind IN ('text','photo','document','video','link')`.

### `automations`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | |
| `trigger_kind` | TEXT NOT NULL | `campaign_join`, `manual`, `tag_added`. CHECK constraint. |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

### `automation_steps`

Ordered steps inside an automation. The scheduler materializes one `scheduled_message` per step at enrollment time.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `automation_id` | BIGINT FK → `automations.id` ON DELETE CASCADE | |
| `position` | INTEGER NOT NULL | 1-based order. |
| `delay_minutes` | INTEGER NOT NULL | Offset from enrollment time. |
| `material_id` | BIGINT FK → `materials.id` ON DELETE RESTRICT | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Indexes: `uq_automation_steps_position` (`automation_id`, `position`), `ix_automation_steps_material_id`.

### `automation_enrollments`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `automation_id` | BIGINT FK → `automations.id` | |
| `user_id` | BIGINT FK → `users.id` ON DELETE CASCADE | |
| `enrolled_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| `status` | TEXT NOT NULL DEFAULT 'active' | `active`, `completed`, `cancelled`. |
| `completed_at` | TIMESTAMPTZ | |

Indexes: `uq_active_enrollment` (`automation_id`, `user_id`) WHERE `status = 'active'` (partial unique).

### `scheduled_messages`

The single outbound queue. Both automations and broadcasts and ad-hoc follow-ups insert rows here.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `user_id` | BIGINT FK → `users.id` ON DELETE CASCADE | Recipient. |
| `material_id` | BIGINT FK → `materials.id` ON DELETE RESTRICT | What to send. |
| `source_kind` | TEXT NOT NULL | `automation`, `broadcast`, `manual`. CHECK. |
| `source_id` | BIGINT | Polymorphic id (automation_enrollment_id / broadcast_id / null). |
| `send_at` | TIMESTAMPTZ NOT NULL | When to send. |
| `status` | TEXT NOT NULL DEFAULT 'pending' | `pending`, `processing`, `sent`, `failed`, `failed_terminal`, `cancelled`. CHECK. |
| `attempts` | INTEGER NOT NULL DEFAULT 0 | |
| `max_attempts` | INTEGER NOT NULL DEFAULT 5 | |
| `last_error` | TEXT | |
| `idempotency_key` | TEXT NOT NULL UNIQUE | `<source_kind>:<source_id>:<step_or_n>:<user_id>`. |
| `locked_at` | TIMESTAMPTZ | Set when worker takes the row. |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Indexes:
- `ix_scheduled_messages_due` on (`status`, `send_at`) — partial WHERE `status = 'pending'`.
- `ix_scheduled_messages_user_id`.
- `uq_scheduled_messages_idempotency_key`.

### `broadcasts`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `name` | TEXT NOT NULL | |
| `material_id` | BIGINT FK → `materials.id` | |
| `segment_id` | BIGINT FK → `segments.id` | Nullable: "all users" if null. |
| `status` | TEXT NOT NULL DEFAULT 'draft' | `draft`, `scheduled`, `sending`, `sent`, `cancelled`, `failed`. CHECK. |
| `scheduled_at` | TIMESTAMPTZ | |
| `started_at`, `finished_at` | TIMESTAMPTZ | |
| `recipient_count` | INTEGER NOT NULL DEFAULT 0 | Snapshot at schedule/send time. |
| `success_count` | INTEGER NOT NULL DEFAULT 0 | |
| `failure_count` | INTEGER NOT NULL DEFAULT 0 | |
| `created_by` | BIGINT FK → `admin_users.id` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

### `broadcast_targets`

Materialized snapshot — guarantees the segment doesn't shift during send.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `broadcast_id` | BIGINT FK → `broadcasts.id` ON DELETE CASCADE | |
| `user_id` | BIGINT FK → `users.id` ON DELETE CASCADE | |
| `scheduled_message_id` | BIGINT FK → `scheduled_messages.id` | Nullable until inserted. |

Indexes: `uq_broadcast_targets` (`broadcast_id`, `user_id`).

### `segments`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `filter_json` | JSONB NOT NULL | DSL: tags, source_campaign_id, language_code, last_seen range, automation status. |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

### `delivery_logs`

One row per Telegram send attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `user_id` | BIGINT FK → `users.id` ON DELETE CASCADE | |
| `scheduled_message_id` | BIGINT FK → `scheduled_messages.id` | Nullable for direct sends. |
| `material_id` | BIGINT FK → `materials.id` | |
| `direction` | TEXT NOT NULL DEFAULT 'outbound' | `outbound`. |
| `telegram_message_id` | BIGINT | Returned by Telegram on success. |
| `status` | TEXT NOT NULL | `sent`, `failed`. |
| `error_code` | TEXT | Telegram error description. |
| `error_payload` | JSONB | Full API error if any. |
| `sent_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Indexes: `ix_delivery_logs_user_id_sent_at` (`user_id`, `sent_at` DESC), `ix_delivery_logs_status`.

### `event_logs`

Append-only system events for diagnostics and product analytics.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `user_id` | BIGINT FK → `users.id` ON DELETE SET NULL | Nullable. |
| `kind` | TEXT NOT NULL | e.g. `user.registered`, `campaign.joined`, `automation.enrolled`, `automation.completed`, `broadcast.scheduled`, `broadcast.sent`, `user.blocked_bot`. |
| `payload` | JSONB NOT NULL DEFAULT '{}'::jsonb | |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Indexes: `ix_event_logs_kind_created_at` (`kind`, `created_at` DESC), `ix_event_logs_user_id_created_at` (`user_id`, `created_at` DESC).

## ER summary

```
admin_users
users ──< user_campaigns >── campaigns ──> automations
users ──< automation_enrollments >── automations ──< automation_steps >── materials
users ──< scheduled_messages >── materials
broadcasts ──< broadcast_targets >── users
broadcasts ── segments
scheduled_messages ──< delivery_logs >── users
users ──< event_logs
```

## Migrations

- Alembic-managed.
- One migration per schema change. No ad-hoc DDL in code.
- Initial migration creates every table above.
- Seed: one `admin_user` from `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` on first boot if no admin exists.
