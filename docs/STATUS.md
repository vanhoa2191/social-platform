# Implementation status

## Completed

### Phase 1 — UI shell
- Dashboard
- Campaign list
- 5-step campaign wizard
- Accounts & profiles
- AI/content UI
- Scheduler shell
- Queue
- Logs
- Analytics
- Settings

### Phase 2 — Chrome Extension MV3 core
- Manifest V3
- background service worker
- Facebook content script
- typed messaging
- IndexedDB and chrome.storage
- runtime diagnostics
- CI/build verification

### Phase 3 — Automation Engine MVP
- deterministic review state machine
- review candidate persistence
- approve / reject / retry
- AI draft edit/regenerate
- prepare approved text in Facebook composer
- verification
- Emergency Stop
- session action limit

### Phase 4 — AI Gateway
- local/gateway mode
- Cloudflare Worker bundle
- provider routing
- server-side provider secrets
- prompt versioning
- structured output validation
- token/cost metadata

### Phase 5 — Queue & Scheduler hardening — DONE
- IndexedDB runtime schema v3
- durable job leases
- stale PROCESSING job recovery
- durable resource locks
- browser/review lock sharing
- capped exponential retry backoff
- persisted review-scan schedules
- 15-minute minimum schedule interval
- configurable daily run window
- manual Run Now
- Facebook tab discovery instead of active-dashboard-tab assumption
- real runtime event log
- scheduler/queue/review event categories
- scheduler UI backed by runtime data
- runtime logs UI backed by runtime data
- runtime status schedule/error counters

## Current product version

0.4.0

## Next

### Phase 6 — Platform adapters & account context
1. Introduce adapter contracts rather than scattered DOM selectors.
2. Add Facebook feed compatibility diagnostics.
3. Add explicit account/profile context detection.
4. Bind schedules/jobs to a verified account context.
5. Add group/page read adapters where the user has access.
6. Preserve human review and manual final submission.
7. Add adapter health status to the dashboard.
