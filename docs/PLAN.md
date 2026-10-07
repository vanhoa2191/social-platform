# AutoTool v2 implementation plan

## Phase 1 — Product shell and UI — DONE
## Phase 2 — Chrome Extension MV3 core — DONE
## Phase 3 — Automation Engine MVP — DONE
## Phase 4 — AI Gateway — DONE
## Phase 5 — Queue & Scheduler hardening — DONE
## Phase 6 — Platform adapters & account context — DONE
## Phase 7 — Cloud data layer — DONE
## Phase 8 — Testing & release hardening — DONE
## Phase 9 — Pilot & production safeguards — DONE

## Phase 10 — Firebase backend migration — DONE IN REPOSITORY

The cloud backend has been changed from Supabase/PostgreSQL to Firebase:

- Firebase Authentication
- Cloud Firestore
- Firestore Security Rules
- Firebase Web config
- MV3-compatible email/password auth using `firebase/auth/web-extension`
- local-first schedule sync
- explicit conflict resolution
- opt-in analytics metadata
- targeted Firebase host permission requests

The old Supabase runtime dependency is removed.

## Phase 11 — Live Firebase pilot — NEXT

Requires user-owned external Firebase resources:

- Firebase development project
- Web App config
- Email/Password Auth enabled
- Firestore database
- deployed Security Rules
- real extension pilot

Google Sign-In can be added later using Firebase's official Manifest V3 offscreen-document flow.
