# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI — DONE
- Design system
- Dashboard
- Campaign list and 5-step wizard
- Profiles, AI profiles, content library
- Schedule, queue, logs, analytics, settings

## Phase 2 — Chrome Extension MV3 core — DONE
- Manifest V3
- Background service worker
- Content scripts
- Typed messaging protocol
- IndexedDB and chrome.storage
- Tab lifecycle handling
- CI and extension build verification

## Phase 3 — Automation engine MVP — DONE
- Deterministic candidate state machine
- Feed scanner integration
- Post fingerprints and review candidates
- AI provider abstraction with local mock provider
- Review queue
- Explicit approve / reject / retry
- Approved text preparation in Facebook composer
- Verification
- Error taxonomy
- Emergency Stop
- session action limit
- preparation lock

## Phase 4 — AI gateway — NEXT
- Cloud API endpoint
- provider abstraction implementation
- prompt registry/versioning
- JSON schema validation
- relevance classifier
- production comment generation
- model fallback
- token/cost accounting
- draft edit/regenerate UI

## Phase 5 — Queue and scheduler hardening
- durable job locks
- per-profile locks
- retry backoff
- cooldown rules
- recurring schedules
- campaign chains
- failure notifications

## Phase 6 — Platform adapters
- stronger feed selectors
- group adapter
- page adapter
- composer adapter revisions
- identity context verification
- DOM compatibility diagnostics

## Phase 7 — Backend
- Auth
- Supabase/PostgreSQL
- campaign sync
- AI gateway endpoint
- analytics aggregation

## Phase 8 — Testing and release
- broader unit tests
- browser integration tests
- Chrome extension packaging
- release channel
- observability
