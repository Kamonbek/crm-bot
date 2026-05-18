# Telegram Bot Flows

The bot is built with **aiogram v3** and runs as a webhook handled by FastAPI. There is no polling in production.

## Webhook setup

- On startup the app calls `setWebhook` with:
  - `url = {PUBLIC_BASE_URL}/telegram/webhook/{TELEGRAM_WEBHOOK_SECRET}`
  - `secret_token = TELEGRAM_WEBHOOK_HEADER_SECRET`
  - `allowed_updates = ["message", "callback_query", "my_chat_member"]`
- On shutdown we do **not** call `deleteWebhook` (other instances may still be live).

## Middlewares

1. **`UserRegistrationMiddleware`** — runs before any handler. Upserts the `users` row from `update.from_user`. Sets `last_seen_at = now()`. Attaches the loaded `User` to the handler context.
2. **`EventLoggingMiddleware`** — emits a generic `telegram.update` event log (kind, user_id, chat_id, update type) for diagnostics.
3. **`BlockedRecoveryMiddleware`** — if a previously `is_blocked=true` user sends a message, clears the flag.

## Commands

| Command | Handler | Purpose |
|---|---|---|
| `/start` | `handlers.start` | Onboarding + deep-link processing. |
| `/help` | `handlers.menu` | Show contact info and available materials. |
| `/contact` | `handlers.menu` | Share teacher's contact card / link. |
| `/materials` | `handlers.menu` | List available public materials. |
| `/stop` | `handlers.menu` | User-initiated opt-out; sets a `unsubscribed` tag, cancels active automations. |

Anything else falls through to `handlers.fallback`, which replies with a short menu hint.

## `/start` flow (with deep-link)

```
User taps t.me/<bot>?start=<code>
        │
        ▼
Telegram sends Update with message.text = "/start <code>"
        │
        ▼
UserRegistrationMiddleware upserts user
        │
        ▼
handlers.start:
  1. Parse <code>. If absent → generic welcome.
  2. services.campaigns.find_by_code(code)
       ├── not found / inactive → generic welcome + log event 'campaign.invalid_code'
       └── found:
            a. INSERT into user_campaigns (unique on user+campaign).
            b. If user.source_campaign_id is null → set it (first-touch).
            c. Send campaign.welcome_material (or default welcome).
            d. If campaign.automation_id is set:
                 - services.automations.enroll(user, automation_id)
                 - Materializes scheduled_messages for each step
                   at enrolled_at + step.delay_minutes.
            e. Emit event 'campaign.joined' with campaign_id.
            f. Reply with a small inline keyboard:
                 [ Материалы ] [ Связаться ]
```

### Re-entry from a different campaign

If the same user clicks a different campaign's deep-link later:

- A new `user_campaigns` row is inserted (it's per-touch attribution).
- `users.source_campaign_id` is **not** overwritten (first-touch is canonical).
- The new campaign's welcome material is sent.
- If the new campaign has an automation and the user has no active enrollment in that exact automation, they're enrolled.

## Automation execution

Automations are *materialized at enrollment time*, not evaluated at send time. This keeps the scheduler trivially simple.

```
enroll(user, automation):
  enrollment = INSERT automation_enrollments
  for step in automation.steps:
    send_at = enrollment.enrolled_at + step.delay_minutes minutes
    INSERT scheduled_messages (
      user_id, material_id=step.material_id,
      source_kind='automation',
      source_id=enrollment.id,
      send_at,
      idempotency_key=f"automation:{enrollment.id}:{step.position}:{user.id}"
    )
```

The scheduler loop later picks each row up at its `send_at` and dispatches the material.

If `services.automations.cancel(user, automation)` is called, all `pending` scheduled_messages for that enrollment are flipped to `cancelled`.

## Broadcast execution

```
schedule(broadcast, when):
  recipients = services.segments.resolve(broadcast.segment_id)  # current snapshot
  for user in recipients:
    INSERT broadcast_targets (broadcast_id, user_id)
    INSERT scheduled_messages (
      user_id, material_id=broadcast.material_id,
      source_kind='broadcast',
      source_id=broadcast.id,
      send_at=when,
      idempotency_key=f"broadcast:{broadcast.id}:{user.id}"
    )
  UPDATE broadcasts SET recipient_count=count, status='scheduled', scheduled_at=when
```

When the scheduler sends each row, it bumps `broadcasts.success_count` / `failure_count` and, when all targets reach a terminal status, sets `broadcasts.status='sent'` and `finished_at=now()`.

## Outbound delivery (services.delivery)

```
send(scheduled_message):
  user   = load user
  if user.is_blocked or user.deleted_at: mark cancelled, log event 'user.skipped'; return
  mat    = load material

  try:
    resp = await bot.send_<kind>(chat_id=user.chat_id, ...)
    INSERT delivery_logs (status='sent', telegram_message_id=resp.message_id)
    UPDATE scheduled_messages SET status='sent'

  except TelegramForbiddenError as e:    # user blocked the bot
    UPDATE users SET is_blocked=true
    INSERT event_logs kind='user.blocked_bot'
    UPDATE scheduled_messages SET status='failed_terminal', last_error=str(e)
    INSERT delivery_logs status='failed'

  except TelegramRetryAfter as e:        # 429 from Telegram
    sleep(e.retry_after) then re-raise to next loop tick

  except TelegramBadRequest as e:        # bad chat_id, deleted account, etc.
    UPDATE scheduled_messages SET status='failed_terminal'

  except TelegramAPIError as e:          # transient
    attempts += 1
    if attempts >= max_attempts:
      status='failed_terminal'
    else:
      status='pending', send_at = now() + backoff(attempts)
```

Rate limiting: a process-local asyncio token bucket allows ≤30 sends/sec global and ≤1/sec per chat.

## Inline keyboards

Common keyboards (defined in `app.telegram.keyboards`):

- **Welcome keyboard**: `Материалы | Связаться` (callback_data: `menu:materials`, `menu:contact`).
- **Confirm opt-out**: `Да, отписаться | Отмена`.

Callback queries route through `handlers.menu.on_callback`, which acks within 3s via `answer_callback_query` to prevent the loading spinner from sticking.

## `my_chat_member` updates

When a user blocks/unblocks the bot, Telegram sends a `my_chat_member` update. The handler:

- new_status `kicked` → `users.is_blocked = true`, log `user.blocked_bot`.
- new_status `member` (recovery) → `users.is_blocked = false`, log `user.unblocked_bot`.

## Error surfaces

- Handler exceptions never propagate to Telegram. The dispatcher catches and logs them with the update id.
- Webhook always returns 200, even on internal errors. Telegram won't retry, which is intentional — we don't want duplicate processing if our DB write failed *after* the user-visible side effect.

## Test chat

Operator-driven preview sends (`POST /api/v1/materials/{id}/preview`) require the operator's own Telegram chat id to be set as `ADMIN_TEST_CHAT_ID` so previews don't require building a separate auth bridge to the dashboard.

## Sequence: end-to-end ad click → first welcome

```
Ad     →  user taps t.me/<bot>?start=ABC123
Telegram →  POST /telegram/webhook/<secret>  Update{ message: "/start ABC123" }
FastAPI  →  aiogram dispatcher
Middleware →  upsert users row
handlers.start:
  - decode "ABC123" → campaign 7
  - insert user_campaigns(user=42, campaign=7)
  - set users.source_campaign_id=7 (first touch)
  - send campaign.welcome_material via bot.send_message
  - enroll user 42 into automation 3 → insert 5 scheduled_messages
  - log event 'campaign.joined'
Response → 200 (webhook ack)
```
