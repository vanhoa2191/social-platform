# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI — DONE

## Phase 2 — Chrome Extension MV3 core — DONE

## Phase 3 — Automation Engine MVP — DONE

## Phase 4 — AI Gateway — DONE

## Phase 5 — Queue & Scheduler hardening — DONE
- durable IndexedDB job leases
- stale worker recovery
- durable runtime resource locks
- exponential retry/backoff
- persistent review-scan schedules
- daily scheduling windows
- Run Now support
- Facebook tab discovery
- real runtime event log
- scheduler/log UI connected to the extension runtime

## Phase 6 — Platform adapters & account context — NEXT
- adapter interface
- feed adapter refactor
- selector compatibility diagnostics
- account/profile context detection
- verified context binding for jobs and schedules
- group/page read adapters
- adapter status UI

## Phase 7 — Backend data layer
- authentication
- Supabase/PostgreSQL
- campaign persistence/sync
- shared AI/profile settings
- analytics aggregation
- browser-instance registration

## Phase 8 — Testing and release
- browser integration tests
- packaged extension
- release channels
- observability
- migrations/upgrades
