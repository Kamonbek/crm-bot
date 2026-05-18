# Architecture

## Overview

A Telegram-first CRM and learning funnel for an Arabic teacher. The product has three runtime surfaces:

1. **Telegram bot** — primary user touchpoint. Receives `/start` deep-links from ads, registers users, delivers materials, runs automation sequences, and pushes scheduled follow-ups and broadcasts.
2. **Admin web dashboard** — operator-facing SPA where the teacher manages campaigns, materials, automations, broadcasts, and inspects delivery logs.
3. **Backend API** — single FastAPI service that serves both the Telegram webhook and the admin REST API. Runs on Cloud Run.

The MVP intentionally avoids Redis and Celery. Scheduled work is database-backed: rows in a `scheduled_messages` table are polled by an in-process scheduler loop running inside the FastAPI app.

## High-level diagram

```
                  ┌────────────────────────────┐
                  │  Telegram users (clients)  │
                  └──────────┬─────────────────┘
                             │ /start <code>, messages
                             ▼
                  ┌────────────────────────────┐
                  │   Telegram Bot API         │
                  └──────────┬─────────────────┘
                             │ webhook (HTTPS)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                Cloud Run (FastAPI app)                      │
│                                                             │
│  ┌────────────────┐   ┌─────────────────┐   ┌────────────┐  │
│  │ Telegram       │   │  Admin REST     │   │  Scheduler │  │
│  │ webhook router │   │  API (JWT)      │   │  loop      │  │
│  │ (aiogram)      │   │                 │   │  (asyncio) │  │
│  └───────┬────────┘   └────────┬────────┘   └─────┬──────┘  │
│          │                     │                  │         │
│          └─────────┬───────────┴──────────────────┘         │
│                    ▼                                        │
│           ┌────────────────────┐                            │
│           │  Service layer     │                            │
│           │  (users, campaigns,│                            │
│           │   automations,     │                            │
│           │   broadcasts, …)   │                            │
│           └─────────┬──────────┘                            │
│                     ▼                                       │
│            SQLAlchemy 2.x async + Alembic                   │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
            ┌────────────────────┐
            │   PostgreSQL       │
            │  (Supabase/Neon)   │
            └────────────────────┘

      ┌──────────────────────────────────┐
      │  Admin SPA (React + Vite + TS)   │
      │  Hosted on GitHub Pages          │
      │  Talks to Cloud Run via HTTPS    │
      └──────────────────────────────────┘
```

## Repo structure

```
arabic-contact-bot/
├── CLAUDE.md
├── README.md
├── .gitignore
├── .env.example
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_SPEC.md
│   ├── TELEGRAM_FLOWS.md
│   ├── DEPLOYMENT.md
│   └── MVP_CHECKLIST.md
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app factory, lifespan, scheduler start
│   │   ├── config.py               # Pydantic settings, env-var loading
│   │   ├── logging.py              # Structured logging setup
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # Declarative base, naming convention
│   │   │   ├── session.py          # async engine, session factory
│   │   │   └── models/             # ORM models, one file per aggregate
│   │   │       ├── user.py
│   │   │       ├── campaign.py
│   │   │       ├── material.py
│   │   │       ├── automation.py
│   │   │       ├── scheduled_message.py
│   │   │       ├── broadcast.py
│   │   │       ├── delivery_log.py
│   │   │       ├── event_log.py
│   │   │       └── admin_user.py
│   │   ├── schemas/                # Pydantic v2 request/response models
│   │   ├── services/               # Business logic, framework-agnostic
│   │   │   ├── users.py
│   │   │   ├── campaigns.py
│   │   │   ├── materials.py
│   │   │   ├── automations.py
│   │   │   ├── scheduling.py
│   │   │   ├── broadcasts.py
│   │   │   ├── segments.py
│   │   │   └── delivery.py         # send + retry + log to delivery_log
│   │   ├── telegram/
│   │   │   ├── __init__.py
│   │   │   ├── bot.py              # aiogram Bot + Dispatcher singletons
│   │   │   ├── webhook.py          # FastAPI route that feeds aiogram
│   │   │   ├── handlers/
│   │   │   │   ├── start.py        # /start <deep-link>
│   │   │   │   ├── menu.py         # help, materials, contact
│   │   │   │   └── fallback.py
│   │   │   ├── keyboards.py
│   │   │   └── middlewares/
│   │   │       ├── user_registration.py
│   │   │       └── event_logging.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py             # JWT auth dep, DB session dep
│   │   │   └── routers/
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── campaigns.py
│   │   │       ├── materials.py
│   │   │       ├── automations.py
│   │   │       ├── broadcasts.py
│   │   │       ├── scheduled.py
│   │   │       ├── logs.py
│   │   │       └── stats.py
│   │   ├── scheduler/
│   │   │   ├── __init__.py
│   │   │   ├── loop.py             # asyncio task, polls scheduled_messages
│   │   │   └── dispatcher.py       # pulls due rows, calls delivery service
│   │   └── core/
│   │       ├── security.py         # JWT, password hashing
│   │       ├── deeplinks.py        # encode/decode campaign codes
│   │       └── errors.py
│   └── tests/
│       ├── conftest.py
│       ├── unit/
│       ├── integration/
│       └── e2e/
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.cjs
    ├── index.html
    ├── public/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── routes.tsx
        ├── api/                    # generated/typed fetch wrappers
        │   ├── client.ts           # axios/fetch + JWT
        │   ├── auth.ts
        │   ├── campaigns.ts
        │   ├── materials.ts
        │   ├── automations.ts
        │   ├── broadcasts.ts
        │   ├── users.ts
        │   └── logs.ts
        ├── auth/
        │   ├── AuthProvider.tsx
        │   ├── useAuth.ts
        │   └── ProtectedRoute.tsx
        ├── components/
        │   ├── layout/
        │   ├── ui/                 # buttons, inputs, tables, modals
        │   └── forms/
        ├── features/
        │   ├── dashboard/
        │   ├── campaigns/
        │   ├── materials/
        │   ├── automations/
        │   ├── broadcasts/
        │   ├── users/
        │   └── logs/
        ├── hooks/
        ├── lib/
        │   └── queryClient.ts      # TanStack Query config
        ├── styles/
        │   └── index.css
        └── types/
            └── api.ts
```

## Backend modules

| Module | Responsibility |
|---|---|
| `app.main` | Build FastAPI app, mount routers, register lifespan (DB warmup, scheduler start/stop, webhook registration on startup). |
| `app.config` | Single source of truth for env vars: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_MIN`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `CORS_ORIGINS`, `SCHEDULER_POLL_SECONDS`, `ENV`. |
| `app.db` | Async engine, session dependency, ORM models, base metadata with consistent naming convention for Alembic. |
| `app.schemas` | Pydantic v2 DTOs. Strict separation from ORM. |
| `app.services` | Business logic. No FastAPI or aiogram imports. Pure functions over a session. |
| `app.telegram` | aiogram Bot, Dispatcher, handlers, middlewares. The webhook endpoint forwards updates into the dispatcher. |
| `app.api` | REST routers grouped by aggregate. All require JWT except `POST /auth/login`. |
| `app.scheduler` | Background asyncio task that polls `scheduled_messages` every N seconds, locks due rows with `SELECT ... FOR UPDATE SKIP LOCKED`, sends through delivery service, retries with backoff. |
| `app.core.security` | JWT issue/verify, bcrypt password hashing, constant-time compare for webhook secret. |
| `app.core.deeplinks` | Encode campaign IDs into short, URL-safe strings for `t.me/<bot>?start=<code>`. |

### Layering rules

- Routers and Telegram handlers may only call **services**.
- Services may only touch the DB through SQLAlchemy sessions and may only call other services.
- Models are dumb — no business logic.
- Schemas are pure data — no business logic.

### Scheduler design

- A single asyncio task started in the FastAPI lifespan event.
- Polls every `SCHEDULER_POLL_SECONDS` (default 15s).
- Query: `SELECT * FROM scheduled_messages WHERE status = 'pending' AND send_at <= now() ORDER BY send_at LIMIT N FOR UPDATE SKIP LOCKED`.
- For each row: marks `processing`, calls delivery, marks `sent` + records `delivery_log`, or `failed` with `error` and `attempts++`.
- Retry policy: exponential backoff up to `max_attempts` (default 5), then `failed_terminal`.
- Cloud Run note: with min-instances=1 and concurrency>0 the loop is always alive. `SKIP LOCKED` keeps it safe even if a second instance starts during a deploy.

## Frontend modules

| Module | Responsibility |
|---|---|
| `auth/` | Login screen, JWT in memory + refresh on reload via httpOnly cookie *or* localStorage (MVP: localStorage). `ProtectedRoute` redirects unauthenticated users to `/login`. |
| `api/client.ts` | Centralized fetch wrapper. Reads `VITE_API_BASE_URL`. Attaches `Authorization: Bearer …`. Handles 401 by clearing token and redirecting. |
| `features/dashboard` | Landing page with KPIs: new users today/7d, scheduled messages pending, broadcasts sent 7d, delivery success rate. |
| `features/campaigns` | List, create, edit campaign. Show deep-link URL with copy-to-clipboard. Show enrollment stats. |
| `features/materials` | CRUD for text/file/link materials. Preview before save. |
| `features/automations` | CRUD for sequences: list of steps with offset (delta from trigger) and material reference. Activate/deactivate. |
| `features/broadcasts` | Compose, choose segment, **preview**, schedule or send-now. Confirmation modal before dispatch. |
| `features/users` | Searchable user table, per-user timeline of events and deliveries. |
| `features/logs` | Delivery log and event log views with filters. |
| `lib/queryClient.ts` | TanStack Query defaults: `staleTime`, retry policy, error toasts. |

### Routing

- `/login`
- `/` → Dashboard (protected)
- `/campaigns`, `/campaigns/:id`
- `/materials`, `/materials/:id`
- `/automations`, `/automations/:id`
- `/broadcasts`, `/broadcasts/new`, `/broadcasts/:id`
- `/users`, `/users/:id`
- `/logs/delivery`, `/logs/events`

### GitHub Pages constraint

The SPA is hosted on `https://<user>.github.io/arabic-contact-bot/`. We use **HashRouter** (or configure Pages with a 404→index fallback) to make deep links survive page refresh. `vite.config.ts` sets `base: '/arabic-contact-bot/'`.

## Cross-cutting concerns

- **Logging**: structured JSON to stdout (Cloud Run collects). Request ID per HTTP request, update ID per Telegram update.
- **Errors**: a single FastAPI exception handler converts `AppError` subclasses into typed JSON `{code, message, details}` responses.
- **Time**: server is UTC. Frontend renders in the operator's timezone.
- **Idempotency**: every outbound message stores a deterministic `idempotency_key` to prevent double-sends if the scheduler retries.
- **Rate limiting**: outbound Telegram messages throttled to stay within Telegram limits (≈30/sec global, 1/sec per chat). Implemented in `services.delivery` with an asyncio token bucket per-process.
