# ADR-0003: JWT Stored in localStorage (Not httpOnly Cookie)

**Status:** Accepted  **Date:** 2026-06-06

## Context

The admin dashboard is a React SPA deployed to GitHub Pages. The backend is a separate Cloud Run origin. Storing the JWT in an `httpOnly` cookie would require CORS `credentials: include`, `SameSite=None; Secure`, and a matching `Set-Cookie` response from the backend — non-trivial to wire correctly across two origins on free-tier hosting.

## Decision

Store the admin JWT in `localStorage`. The React app reads it from there and attaches it as an `Authorization: Bearer …` header on every API call.

## Consequences

- **XSS risk:** a script injected into the SPA can read `localStorage` and exfiltrate the token. This is a known tradeoff accepted for the MVP.
- **Mitigations in place:** the admin UI has a small attack surface (no user-generated HTML rendered unsanitized; Vite's Content-Security-Policy headers can be added post-launch).
- **Simpler CORS:** backend only needs to allow the `Authorization` header; no cookie credential dance required.
- **Deferred hardening:** post-launch, migrate to a `httpOnly` cookie with a `/auth/refresh` endpoint once the deployment is stable and the CORS configuration is locked down.
