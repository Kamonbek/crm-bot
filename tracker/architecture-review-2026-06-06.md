# Architecture review — whole repo, 2026-06-06

**Scope:** Whole repo (backend/app/ + frontend/src/)
**ADRs read:** 0 (no docs/adr/ directory exists)
**Findings:** 6 total — S2×2, S3×3, S4×1

---

## Summary

Two confirmed layer violations in the backend: `stats.py` is a god-query router that bypasses the service and repository layers entirely, and `broadcasts.py`'s preview endpoint does the same for recipient counting. Both were verified by direct code read. The frontend has no import cycles and clean type safety, but every form page inlines its mutation and validation logic instead of extracting to custom hooks. The scheduler and sender are the only critical-path services with no dedicated tests. No ADRs exist, so all architectural decisions (Cloud Run scheduler design, Supabase pooler choice, DB-backed scheduling over Redis) are in prose docs with no durable decision trail.

---

## Findings

### F1 — stats.py: god-query router (S2, effort: M, confidence: High)

**Where:** `backend/app/api/routers/admin/stats.py:11–16`, `stats.py:42–70`

**Symptom:** The router imports 7 model classes directly and executes 11 raw `SELECT count(*)` queries inline in the handler function. There is no stats service, no stats repository, and no abstraction at all — all data-layer knowledge lives in the router.

**Root cause hypothesis:** Stats was likely added quickly as a "one-off" endpoint and never extracted. Because it has no mutations, the absence of a service felt acceptable at the time.

**Proposed refactor:** Create `backend/app/services/stats.py` with a single `async def get_dashboard_stats(session) -> StatsOut` function. Move all 11 queries there. The router becomes a 5-line passthrough. Alternatively, extend existing repositories with `count_*` methods and call them from a thin stats service.

**ADR exposure:** No ADR governs this. A new ADR should record the rule: "aggregate queries that span multiple entities belong in a service, not a router."

**Out of scope:** This finding is NOT recommending splitting stats into per-entity endpoints or adding caching.

---

### F2 — broadcasts.py: preview endpoint bypasses repository (S2, effort: S, confidence: High)

**Where:** `backend/app/api/routers/admin/broadcasts.py:11–13`, `broadcasts.py:33–49`

**Symptom:** The `/preview` endpoint imports `User` and `UserSegment` models directly and builds a raw `SELECT count()` query in the router. The rest of `broadcasts.py` uses `broadcast_repo` correctly — this one endpoint is inconsistent.

**Root cause hypothesis:** The preview query spans two tables (User + UserSegment) and didn't fit cleanly into an existing repo method, so it was written inline as a quick solution.

**Proposed refactor:** Add `count_recipients(session, segment_id: UUID | None) -> int` to `backend/app/repositories/broadcasts.py`. The router calls `await broadcast_repo.count_recipients(session, body.segment_id)` and drops the three model imports.

**ADR exposure:** None needed — the fix just restores consistency with the existing pattern.

**Out of scope:** Not recommending a segment-aware broadcast service; the query logic alone is enough.

---

### F3 — Frontend form pages: business logic not extracted to hooks (S3, effort: M, confidence: High)

**Where:** `frontend/src/pages/BroadcastCreate.tsx:10–66`, `CampaignForm.tsx`, `MaterialForm.tsx`, `SequenceForm.tsx`

**Symptom:** `BroadcastCreate.tsx` contains a 3-step state machine (`compose → preview → send`), three `useMutation` calls, and step-transition logic all inside the component body. `CampaignForm`, `MaterialForm`, and `SequenceForm` follow the same pattern. Only `useAuth` has been extracted to a custom hook.

**Root cause hypothesis:** The `useAuth` hook was intentionally extracted, but CRUD forms were written directly and the pattern wasn't applied consistently.

**Proposed refactor:** Extract `useBroadcastWizard()`, `useCampaignForm()`, `useMaterialForm()`, and `useSequenceForm()` hooks under `frontend/src/hooks/`. Each hook owns: state, mutations, validation, and error handling. Page components become pure layout/JSX.

**ADR exposure:** None needed — this is a React conventions fix.

**Out of scope:** Not recommending a form library (react-hook-form, etc.) — vanilla hooks are sufficient at this scale.

---

### F4 — sender.py: no dedicated tests for critical-path service (S3, effort: S, confidence: High)

**Where:** `backend/app/services/sender.py` (all message types), `backend/tests/` (no test_sender.py)

**Symptom:** `sender.py` handles 5 dispatch branches (TEXT, PHOTO, DOCUMENT, VIDEO, LINK) and is called on every scheduled message, every broadcast, and every automation step. It has zero dedicated tests. The scheduler tests exercise it indirectly, but no test isolates the dispatch-by-material-kind logic or verifies that parse_mode and disable_web_page_preview flags are forwarded correctly.

**Root cause hypothesis:** The service is small (< 60 lines), which made it easy to skip — but small doesn't mean uncritical.

**Proposed refactor:** Add `backend/tests/test_sender.py`. Mock `aiogram.Bot`. Parametrize across all 5 `MaterialKind` values. Assert the correct Bot method is called with the correct kwargs per kind.

**ADR exposure:** None needed.

**Out of scope:** Not recommending integration tests against the real Telegram API.

---

### F5 — No ADRs: architectural decisions are undocumented (S3, effort: S, confidence: High)

**Where:** `docs/` (no adr/ subdirectory)

**Symptom:** Several non-obvious architectural choices are recorded only in prose docs (ARCHITECTURE.md, CLAUDE.md) without a decision log. Examples: DB-backed scheduling instead of Redis/Celery (an active tradeoff); Supabase Supavisor on port 6543 for Cloud Run horizontal scaling; `SKIP LOCKED` for scheduler concurrency; JWT in localStorage (not httpOnly cookie). The next contributor or the next review has no way to know whether these are deliberate or accidental.

**Root cause hypothesis:** ADRs weren't part of the initial scaffold.

**Proposed refactor:** Create `docs/adr/` with a template (see [adr.md](https://adr.github.io/)). Record at minimum: ADR-0001 (DB-backed scheduler, no Redis), ADR-0002 (Supabase + transaction pooler), ADR-0003 (JWT localStorage for MVP). Each is < 1 page.

**ADR exposure:** This finding IS about ADRs — the fix creates them.

**Out of scope:** Not recommending a full RFC process or Architectural Decision Records tooling.

---

### F6 — telegram/handlers.py: late-binding repository imports (S4, effort: S, confidence: High)

**Where:** `backend/app/telegram/handlers.py:87–101`

**Symptom:** `from app.repositories import events as event_repo` and `from app.repositories import users as user_repo` appear inside handler functions rather than at module top-level. The rest of the Telegram layer uses `telegram/service.py` for data access. This inconsistency makes static analysis harder and signals that the handler is doing work that belongs in the service.

**Root cause hypothesis:** Likely a circular-import workaround added during development.

**Proposed refactor:** Move the data-access calls in those handlers into `telegram/service.py`. The handler delegates to the service; the service holds the repo imports at top level.

**ADR exposure:** None needed.

**Out of scope:** Not recommending aiogram dependency injection middleware changes.

---

## Not recommended

- **User.phone not in UserOut schema**: Confirmed gap, but likely intentional (phone is sensitive, not needed by the dashboard). Skipping.
- **ScheduledMessage lacks Out schema**: Internal-only model used by the scheduler; never returned to clients. Skipping.
- **campaigns.py setattr pattern** (lines 70–72): Direct field mutation after fetch is idiomatic SQLAlchemy for simple updates. Not a meaningful violation at this scale.
- **Frontend components importing 2–3 API modules**: BroadcastCreate, CampaignForm, SequenceForm all cross-import related API modules. All are justified by multi-entity forms. No finding.

---

## Pre-existing decisions you should NOT undo

- **DB-backed scheduler (no Redis/Celery)**: Deliberately chosen for MVP to avoid operational complexity. `SKIP LOCKED` makes it safe under horizontal Cloud Run scaling. Do not add Redis without an ADR.
- **JWT in localStorage**: Documented MVP tradeoff. httpOnly cookies are the right long-term fix but were deferred. Don't change without also updating the auth flow and CORS config.
- **Supabase Supavisor on port 6543**: Required for Cloud Run horizontal scaling (transaction pooler mode). Do not switch to direct Postgres connection (port 5432) on Cloud Run.
- **aiogram v3 + FastAPI webhook mode**: The `telegram/bot.py` singleton pattern is intentional for lifespan management. Don't move to polling mode.

---

## Suggested order of operations

1. **F2** — broadcasts preview repo method (S2, S effort): 30-minute fix, restores layer consistency, easiest win.
2. **F1** — stats.py god-query extraction (S2, M effort): highest leverage by severity/effort after F2.
3. **F4** — test_sender.py (S3, S effort): small, covers a critical path, done in one sitting.
4. **F5** — ADRs (S3, S effort): write 3 decision records while the context is fresh from this review.
5. **F3** — frontend custom hooks (S3, M effort): biggest frontend readability gain; do after backend is clean.
6. **F6** — telegram handlers (S4, S effort): cosmetic; defer until a handler change is needed anyway.

Each finding can be picked up with `/squid:refactor F{N}` (paste the finding body as the refactor goal). Tackle one at a time — don't batch F1 + F3 into one PR.
