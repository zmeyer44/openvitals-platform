# OpenVitals Platform

Backend-first scaffold for a provenance-aware personal health data platform.

## Stack

- pnpm workspace
- TanStack Start web app in `apps/web`
- Better Auth for session and account management
- PostgreSQL with Drizzle ORM in `packages/database`
- Domain validators and policy/security helpers in `packages/domain`
- Parser contracts and ingestion pipeline in `packages/ingestion`
- Durable events, audit helpers, and outbox in `packages/events`
- Background workers in `packages/workers`

## Local Development

```sh
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The initial focus is backend correctness: durable import jobs, canonical health records, provenance, review tasks, SQL-enforced sharing predicates, signed webhook helpers, encrypted integration token utilities, audit events, and a transactional outbox.

## Foundation Checks

```sh
pnpm typecheck
pnpm test
pnpm db:check
pnpm build
```

`pnpm test` includes unit tests plus Postgres integration tests when `DATABASE_URL` or `TEST_DATABASE_URL` is set. The integration suite verifies migrated tables, provenance constraints, durable jobs, outbox/audit transitions, SQL-enforced sharing predicates, authenticated ownership, and import system behavior.

Canonical health records (`observations`, `conditions`, `medications`, and `encounters`) require a source record. Source records are the common entry point for files, manual entries, intake answers, and integration-derived records, while the `provenance` table preserves the derivation and actor context.

## Authentication And Ownership

Better Auth owns identity tables (`auth_users`, `auth_sessions`, `auth_accounts`, and `auth_verifications`). OpenVitals health data remains owned by `app_users.id`; `app_users.external_auth_id` maps the Better Auth user ID to the stable OpenVitals owner UUID.

API paths must derive `ownerUserId` from the authenticated owner context, not from request bodies. Actor identity is represented explicitly as one of `user`, `recipient`, `worker`, `integration`, `admin`, or `system`, and audit/outbox records persist that actor type plus ID where applicable.

RLS is intentionally deferred for now. Until sharing and admin flows settle, access control lives in typed SQL predicate helpers and route-level ownership context; the sharing queries enforce recipient/category/time-window predicates in SQL rather than filtering after retrieval.

## Import System V1

`POST /api/imports` accepts `multipart/form-data` with a `file` field and optional `idempotencyKey`. Base64 JSON uploads are no longer part of the API path. The route derives ownership from the authenticated session and writes the blob through stable internal object keys.

Imports now persist parser classification decisions in `file_classifications` and visible state transitions in `import_status_history`. `GET /api/imports` lists owner-scoped imports with queue state, `GET /api/imports/$importJobId` returns document, classification, history, source-record, review-task, and queue detail, and `POST /api/imports/$importJobId/retry` requeues failed or dead-lettered work.

The parser registry records explicit supported, unsupported, empty, review-needed, and error decisions. CSV labs remain the first materializing parser; PDF and image files are intentionally classified into review-needed placeholder tasks until real extractors are available.
