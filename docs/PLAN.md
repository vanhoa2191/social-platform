# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI — DONE
## Phase 2 — Chrome Extension MV3 core — DONE
## Phase 3 — Automation Engine MVP — DONE
## Phase 4 — AI Gateway — DONE
## Phase 5 — Queue & Scheduler hardening — DONE
## Phase 6 — Platform adapters & account context — DONE
## Phase 7 — Backend data layer — DONE IN REPOSITORY

## Phase 8 — Testing & release hardening — DONE IN REPOSITORY
- fixture-based Facebook adapter tests
- composer preparation integration fixture
- IndexedDB migration/data-preservation tests
- runtime DB version diagnostics
- schedule sync conflict policy tests
- explicit cloud/local conflict resolution
- extension ZIP packaging
- SHA-256/checksum metadata
- release package verification
- PR/branch CI artifacts
- tag-based GitHub Release workflow

Live Supabase migration validation remains blocked only by the lack of an available connected Supabase project.

## Phase 9 — Pilot & production readiness — NEXT
- development Supabase deployment
- RLS/security advisor review
- real-browser compatibility pilot
- approved Facebook layout fixtures
- optional error telemetry
- beta/stable promotion policy
- controlled pilot rollout
