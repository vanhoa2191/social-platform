# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI — DONE
- Design system
- Dashboard
- Campaign wizard
- Profiles
- AI/content UI
- Scheduler
- Queue
- Logs
- Analytics
- Settings

## Phase 2 — Chrome Extension MV3 core — DONE
- Manifest V3
- Background service worker
- Content scripts
- Typed messages
- IndexedDB/chrome.storage
- runtime diagnostics
- CI/build verification

## Phase 3 — Automation engine MVP — DONE
- deterministic candidate state machine
- feed scanner integration
- review queue
- explicit approval
- Facebook composer preparation
- verification
- Emergency Stop
- limits and locking

## Phase 4 — AI gateway — DONE
- local/gateway mode
- Cloudflare Worker bundle
- provider routing for OpenAI-compatible, DeepSeek, Anthropic and Gemini
- server-side secrets
- prompt registry/versioning
- structured response validation
- health check
- origin permission flow
- token/cost metadata
- draft edit and regeneration

## Phase 5 — Queue and scheduler hardening — NEXT
- durable locks
- per-profile locks
- retry backoff
- cooldown rules
- persistent schedules
- campaign chains
- notifications
- runtime event log

## Phase 6 — Platform adapters
- stronger feed selectors
- group adapter
- page adapter
- composer adapter revisions
- identity context verification
- DOM compatibility diagnostics

## Phase 7 — Backend data layer
- Auth
- Supabase/PostgreSQL
- campaign persistence/sync
- analytics aggregation
- shared prompt/profile configuration
- device/browser-instance registration

## Phase 8 — Testing and release
- browser integration tests
- packaged extension
- release channels
- observability
- upgrade/migration strategy
