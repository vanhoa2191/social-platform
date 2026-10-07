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

### Phase 6 — Platform adapters & account context — DONE
- platform adapter contract and registry
- centralized Facebook selectors
- `facebook-web-v1` adapter
- Feed / Group / Page / Post surface classification
- account-context detection from navigation/header evidence
- stable account context keys
- adapter diagnostics and health status
- live Browser Context UI
- fake account table removed
- schedule binding to verified account context
- per-account queue resource keys
- scheduled tab lookup by expected account context
- review candidate account/surface metadata
- approved-comment preparation requires matching verified context
- old unbound schedules are prevented from running until rebound

## Current product version

0.5.0

## Next

### Phase 7 — Backend data layer
1. Add authentication and browser-instance identity.
2. Add Supabase/PostgreSQL persistence.
3. Sync campaigns, AI profiles and schedule definitions.
4. Keep browser-only session state local.
5. Add analytics event aggregation.
6. Add prompt/profile sharing without sharing provider API keys.
7. Define local-first/offline behavior when backend is unavailable.
