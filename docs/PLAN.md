# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI — DONE
## Phase 2 — Chrome Extension MV3 core — DONE
## Phase 3 — Automation Engine MVP — DONE
## Phase 4 — AI Gateway — DONE
## Phase 5 — Queue & Scheduler hardening — DONE
## Phase 6 — Platform adapters & account context — DONE
## Phase 7 — Backend data layer — DONE IN REPOSITORY
## Phase 8 — Testing & release hardening — DONE IN REPOSITORY

## Phase 9 — Pilot & production readiness — DONE IN REPOSITORY

Implemented:

- pilot mode defaults to enabled
- low-volume caps enforced by runtime
- Pilot Readiness checklist
- account/adapter/database/safety checks
- release channel visible in runtime
- telemetry opt-in with privacy-minimized payload
- consent timestamp so pre-consent logs are never uploaded after later opt-in
- Supabase host permission requested from explicit user actions
- Backend/Supabase code split from the initial dashboard bundle
- beta and stable package channels
- stable promotion gate
- GitHub production environment for stable releases

## Phase 10 — Real environment pilot — NEXT

Requires external environment/user decision:

- a real Supabase development project
- migration deployment
- RLS/security advisor review
- Auth redirect configuration
- controlled testing on approved Facebook test accounts
- beta pilot acceptance criteria
- stable promotion after pilot review

No Supabase project is created automatically.
