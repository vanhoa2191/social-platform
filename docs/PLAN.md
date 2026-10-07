# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI — DONE
## Phase 2 — Chrome Extension MV3 core — DONE
## Phase 3 — Automation Engine MVP — DONE
## Phase 4 — AI Gateway — DONE
## Phase 5 — Queue & Scheduler hardening — DONE
## Phase 6 — Platform adapters & account context — DONE
## Phase 7 — Cloud data layer — DONE
## Phase 8 — Testing & release hardening — DONE
## Phase 9 — Pilot safeguards — DONE
## Phase 10 — Firebase backend migration — DONE
## Phase 11 — Firebase emulator & security hardening — DONE IN REPOSITORY

Phase 11 adds:

- Firebase Emulator Suite configuration
- Firebase app emulator mode
- Firestore Security Rules allowlist
- ownership/integrity/privacy rule tests
- Java 21 emulator validation in CI and release
- Firebase emulator visibility in Settings

## Phase 12 — Real environment pilot — NEXT

Requires user-owned external resources:

- Firebase development project
- Firebase Web App config
- Email/Password Auth enabled
- Firestore database
- deployed Security Rules
- approved Facebook test accounts
- pilot acceptance decision

At this point, remaining work is environment deployment and controlled validation rather than missing core repository architecture.
