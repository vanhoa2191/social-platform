# Implementation status

## Completed

### Phase 1 — UI shell
- Dashboard
- Campaign list
- Campaign wizard
- AI/content UI
- Scheduler/queue/logs/settings shells

### Phase 2 — Chrome Extension MV3 core
- Manifest V3
- background service worker
- Facebook content script
- typed messaging
- IndexedDB/chrome.storage
- build verification

### Phase 3 — Automation Engine MVP
- deterministic review state machine
- candidate persistence
- approve / reject / retry
- draft edit/regenerate
- approved-text composer preparation
- Emergency Stop and session limits

### Phase 4 — AI Gateway
- local/gateway mode
- Cloudflare Worker bundle
- provider routing
- prompt versioning
- structured output validation
- token/cost metadata

### Phase 5 — Queue & Scheduler hardening
- durable job leases
- stale worker recovery
- resource locks
- retry backoff
- persisted schedules
- runtime events
- real scheduler/log UI

### Phase 6 — Platform adapters & account context
- platform adapter contract
- Facebook adapter
- account-context binding
- adapter diagnostics
- account-aware queue locks
- account-aware review preparation

### Phase 7 — Backend data layer — DONE IN REPOSITORY
- Supabase JS client integration
- local-only fallback when backend is not configured
- email magic-link auth flow
- extension-safe auth storage
- browser-instance registration
- PostgreSQL schema migration
- Row Level Security policies
- campaigns repository
- AI profiles repository
- schedule-definition sync
- analytics-event sync
- idempotent event upload
- sync watermark
- revision-aware schedule conflict detection
- Backend & Sync settings UI
- no service-role/secret key exposed in extension

## Current product version

0.6.0

## Deployment note

No Supabase project is currently attached through the connector, so the migration is prepared but not applied to a live project.

## Next

### Phase 8 — Testing & release
1. Add fixture-based Facebook adapter tests.
2. Add browser integration tests.
3. Add migration validation against a development Supabase project.
4. Add packaged extension release build.
5. Add upgrade/migration checks for IndexedDB.
6. Add runtime observability and release channel metadata.
7. Add explicit schedule conflict-resolution UI.
