# ADR-0002: Supabase Supavisor Transaction Pooler on Port 6543

**Status:** Accepted  **Date:** 2026-06-06

## Context

Cloud Run can spin up many container instances in response to traffic. Each instance opens its own SQLAlchemy connection pool. With a direct Postgres connection (port 5432), even a modest horizontal scale-out can exhaust Supabase's free-tier connection limit (~15–20 direct connections).

## Decision

Connect via the Supabase Supavisor transaction-mode pooler (`aws-0-REGION.pooler.supabase.com:6543`). Each backend request borrows a server connection for the duration of a transaction and returns it immediately; idle Cloud Run instances hold no connections.

```
DATABASE_URL=postgresql+asyncpg://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

SQLAlchemy pool is intentionally small (`pool_size=2`, `max_overflow=3`) because the pooler is the real multiplexer.

## Consequences

- **Connection efficiency:** 10 Cloud Run instances × 2 pool slots = 20 logical connections, but Supavisor multiplexes these onto far fewer real Postgres connections.
- **No prepared statements:** transaction-mode pooling does not support server-side prepared statements; SQLAlchemy must use `prepared_statement_cache_size=0` (already set via asyncpg connect args).
- **Latency:** one extra network hop through the pooler; negligible for this workload.
- **Session-mode features blocked:** `LISTEN/NOTIFY` and advisory locks require session-mode (port 5432); these are not used in the MVP.
