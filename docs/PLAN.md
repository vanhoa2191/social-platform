# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI — DONE

## Phase 2 — Chrome Extension MV3 core — DONE

## Phase 3 — Automation Engine MVP — DONE

## Phase 4 — AI Gateway — DONE

## Phase 5 — Queue & Scheduler hardening — DONE

## Phase 6 — Platform adapters & account context — DONE

## Phase 7 — Backend data layer — DONE IN REPOSITORY
- Supabase/PostgreSQL migration
- RLS security model
- publishable-key client
- Auth session persistence
- magic-link authentication
- browser-instance registration
- campaigns repository
- AI-profile repository
- schedule-definition sync
- revision conflict detection
- analytics-event sync with idempotency
- local-first fallback
- backend status/sync UI

The migration has not been deployed because there is currently no connected Supabase project.

## Phase 8 — Testing and release — NEXT
- fixture-based adapter tests
- browser integration tests
- Supabase migration integration test
- extension packaging
- release metadata
- migration/upgrade verification
- observability
- conflict-resolution UI
