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

## Phase 12 — Production hardening — MERGED (#16)

- Firebase Auth ID token verification, CORS, MV3 permission restrictions
- Cloud Firestore CRUD catalogs, owner-only Rules, local data owner isolation
- 64/64 unit/fixture and 9/9 Firestore Rules checks; CI green at merge

## Phase 13 — Staging integration & quota (IN BRANCH)

- [x] Add real Firebase Auth + Firestore emulator integration tests
- [x] Replace in-memory paid-provider quota with per-UID Durable Object counter
- [x] Fail closed when paid AI provider lacks quota binding
- [x] Harden gateway request origin checks and sanitize upstream error output
- [x] Add staging preflight, .env/wrangler ignores and staging runbook
- [ ] Obtain user-owned Firebase staging Web config and deployment approval
- [ ] Deploy dev Firestore Rules and Cloudflare Worker with real Firebase auth
- [ ] Real Chrome/Facebook manual-submit pilot with account isolation and audit
- [ ] Approve stable release only after pilot and GitHub Environment review
