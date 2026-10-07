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

### Phase 6 — Platform adapters & account context
- Facebook adapter contract
- account-context binding
- adapter diagnostics
- account-aware queue locks
- account-aware review preparation

### Phase 7 — Backend data layer
- optional Supabase client
- local-only fallback
- auth/session storage
- PostgreSQL migration + RLS
- browser instance registration
- campaign/AI profile repositories
- schedule sync
- analytics sync

### Phase 8 — Testing & release hardening
- Facebook fixture integration tests
- IndexedDB migration/data-preservation tests
- release ZIP/checksum/metadata
- CI artifacts
- tag-based GitHub Release
- explicit sync conflict resolution

### Phase 9 — Pilot & production readiness — DONE IN REPOSITORY
- pilot mode enabled by default
- configurable pilot caps for posts/run and actions/session
- effective pilot limits enforced by runtime
- Pilot Readiness UI
- runtime DB/account/adapter/safety readiness checks
- release-channel diagnostics
- telemetry explicitly opt-in and off by default
- telemetry consent timestamp prevents pre-consent events from being uploaded later
- telemetry payload excludes post/comment/runtime message/detail text
- Supabase host permission requested only from user-triggered actions
- backend bundle lazy-loaded to reduce startup payload
- beta/stable release gate
- stable tag must match manifest version
- stable release requires explicit approval flag
- GitHub production environment wired into stable release workflow
- package manifest stamped with beta/stable channel

## Current product version

0.8.0

## Validation status

- lint: pass with 0 warnings / 0 errors
- automated tests: 33/33 passed
- TypeScript: pass
- dashboard production build: pass
- initial application chunk reduced through Backend lazy loading
- Chrome Extension build verification: pass
- AI Gateway bundle: pass
- beta package verification: pass
- stable release gate: rejects unapproved release
- stable package verification: pass with approval + matching tag
- dev server: HTTP 200

## External deployment note

The connected Supabase account currently exposes **no project**. The SQL migration therefore remains prepared but has not been applied to a live development database.

No Supabase project is created automatically because project creation can carry billing/resource implications.

## Next

### Phase 10 — Real environment pilot
1. Select or create a Supabase development project.
2. Apply migrations and run Supabase security/performance advisors.
3. Configure Auth redirect URL for the unpacked extension.
4. Pilot the extension on approved test Facebook accounts/layouts.
5. Record adapter compatibility findings without collecting private post/comment content.
6. Require a clean pilot checklist before stable promotion.
7. Merge the stacked implementation branches after review.
