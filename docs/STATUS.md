# Implementation status

## Completed

### Phase 1 — UI shell
- Dashboard
- Campaign list/wizard
- AI/content UI
- Scheduler/queue/log/settings shells

### Phase 2 — Chrome Extension MV3 core
- background service worker
- Facebook content script
- typed runtime messaging
- IndexedDB/chrome.storage

### Phase 3 — Automation Engine MVP
- deterministic review state machine
- approve/reject/retry
- draft edit/regenerate
- approved-text composer preparation
- Emergency Stop and session limits

### Phase 4 — AI Gateway
- local/gateway modes
- provider routing
- prompt versioning
- structured output validation
- token/cost metadata

### Phase 5 — Queue & Scheduler hardening
- durable leases
- stale worker recovery
- resource locks
- retry/backoff
- persisted schedules
- runtime events

### Phase 6 — Platform adapters & account context
- Facebook adapter
- account context binding
- adapter diagnostics
- account-aware locks and preparation

### Phase 7 — Cloud data layer
- local-first cloud model
- browser instances
- campaigns
- AI profiles
- schedule sync
- revision conflict resolution
- opt-in analytics metadata

### Phase 8 — Testing & release hardening
- Facebook fixture tests
- IndexedDB migration tests
- release ZIP/checksum/metadata
- GitHub CI
- tag-based releases

### Phase 9 — Pilot safeguards
- pilot mode default-on
- low-volume limits
- readiness checklist
- opt-in telemetry
- beta/stable promotion gate

### Phase 10 — Firebase backend migration
- Firebase Auth for MV3
- Cloud Firestore
- Firestore Security Rules
- Firebase environment config
- Firebase setup guide
- Supabase runtime dependency removed

### Phase 11 — Firebase emulator & security hardening — DONE IN REPOSITORY
- Firebase Auth/Firestore emulator configuration
- application emulator mode
- stricter allowlisted Firestore Security Rules
- cross-user isolation tests
- unauthenticated access tests
- stable document identity checks
- telemetry privacy rule tests
- unknown collection deny-by-default test
- Java 21 Firebase emulator tests in CI
- Java 21 Firebase emulator tests in stable release workflow
- backend UI indicates emulator mode
- default test suite remains independent of Java/emulator availability

## Current product version

0.10.0-beta

## Local validation

The standard build/test suite can run without Java:

```bash
npm run check
```

Firestore Rules integration tests require Java 21:

```bash
npm run test:firebase-emulator
```

CI installs Java 21 automatically.

## Remaining external work

Only real-environment work remains:

1. create/select a real Firebase development project;
2. register a Web App and copy config;
3. enable Email/Password Auth;
4. create Firestore;
5. deploy Security Rules;
6. verify the same isolation checks against the dev project;
7. run the controlled Facebook pilot;
8. promote beta to stable only after pilot acceptance.

No Firebase project is created automatically because ownership and billing choices remain user-controlled.
