---
name: api-design
description: Conventions for API routes, server actions, and data validation. Read before building any backend endpoint.
---

# API Design Skill

## Endpoint structure
- REST-style routes under `src/app/api/[resource]/route.ts`.
- One file per resource. GET/POST/PUT/DELETE handlers exported by name.
- Server actions for form submissions inside the same component tree where possible. API routes for anything called from a third party or a non-React client.

## Validation
- Every input crosses a Zod schema before reaching business logic.
- Define schemas in `src/lib/schemas/` and import them. Never inline.
- On validation failure: return `400` with `{ error: "validation", issues: [...] }`.

## Auth
- Protected routes check the session at the top of the handler. If no session, return `401` immediately, before any DB query.
- Never trust client-provided user IDs. Use the session user.

## Errors
- Wrap external calls (DB, third-party APIs) in try/catch.
- Log the real error server-side. Return a sanitized error to the client — no stack traces, no DB error messages.
- Status codes: `400` validation, `401` not authenticated, `403` not authorized, `404` not found, `409` conflict, `500` server.

## Response shape
- Success: `{ data: ... }`
- Error: `{ error: string, issues?: ... }`
- Stay consistent. The frontend should be able to assume this shape everywhere.

## What to avoid
- `any` in request or response types.
- Raw SQL string concatenation. Use the ORM or parameterized queries.
- Returning DB rows directly — pick the fields you actually want to expose.
- Logging secrets or full request bodies.
