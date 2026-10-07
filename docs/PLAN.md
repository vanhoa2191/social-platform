# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI
- Design system
- Dashboard
- Campaign list and 5-step wizard
- Profiles, AI profiles, content library
- Schedule, queue, logs, analytics, settings

## Phase 2 — Chrome Extension MV3 core
- Manifest V3
- Background service worker
- Content scripts
- Typed messaging protocol
- IndexedDB and chrome.storage
- Tab lifecycle handling

## Phase 3 — Automation engine MVP
- Deterministic state machine
- Feed scanner adapter
- Post parser
- Human review queue
- Action executor and verification
- Pause, stop, emergency controls

## Phase 4 — AI gateway
- Provider abstraction
- Prompt registry and versioning
- Structured JSON validation
- Relevance classifier
- Comment generation
- Token and cost accounting

## Phase 5 — Queue and scheduler hardening
- Local locks
- Duplicate fingerprints
- Retry and cooldown policy
- Recurring schedules
- Campaign chains

## Phase 6 — Platform adapters
- Feed
- Group
- Page
- Composer
- Comment
- Identity context verification

## Phase 7 — Backend
- Auth
- Supabase/PostgreSQL
- Campaign sync
- AI gateway endpoint
- Analytics aggregation

## Phase 8 — Testing and release
- Unit tests
- UI tests
- Browser integration tests
- Extension packaging
- CI
