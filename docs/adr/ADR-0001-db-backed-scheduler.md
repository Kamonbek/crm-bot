# ADR-0001: DB-Backed Scheduler (No Redis/Celery)

**Status:** Accepted  **Date:** 2026-06-06

## Context

The bot needs to send scheduled follow-up messages (sequence steps, broadcast delivery). A task queue like Celery+Redis is the conventional solution, but introduces operational complexity: two extra services to provision, monitor, and scale on a free-tier deployment.

## Decision

Use a PostgreSQL-backed scheduler: a `scheduled_messages` table stores pending jobs; a background worker polls it with `SELECT … FOR UPDATE SKIP LOCKED` to claim rows atomically without a separate broker.

## Consequences

- **Simpler ops:** no Redis or Celery workers to manage; single Cloud Run service + Supabase covers everything.
- **Concurrency safe:** `SKIP LOCKED` prevents double-delivery even when Cloud Run scales to multiple instances.
- **Throughput ceiling:** polling at DB granularity (~1 s) is sufficient for an Arabic-teacher bot but would not scale to thousands of messages per second without moving to a real queue.
- **Deferred complexity:** if volume outgrows DB polling, a drop-in replacement with a real queue is straightforward because the worker interface is isolated behind the scheduler service.
