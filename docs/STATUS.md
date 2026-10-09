# Implementation status

## Current product version

**0.14.0-beta**

## Implemented in repository

- Chrome Extension Manifest V3 runtime with background worker and Facebook content script.
- Local-first IndexedDB queue, review candidates, locks, schedules, events and retention.
- Review-before-action workflow: scan → AI draft → edit/regenerate → approve snapshot → prepare composer.
- Final Facebook submission remains manual.
- Emergency Stop, pilot caps, account-context binding, durable queue leases and retry/backoff.
- Firebase Auth + Cloud Firestore with owner-scoped Security Rules and Auth/Firestore emulator integration tests.
- Revision-aware schedule sync, explicit local/cloud conflicts, revision-aware delete tombstones.
- Firebase AI Profile and Content Library CRUD.
- AI Gateway with Firebase ID-token auth, exact trusted gateway-origin pinning, structured model output and provider timeout handling.
- Cloudflare Durable Object per-UID request quota plus global daily paid-AI request ceiling.
- Optional Firebase UID allowlist for controlled AI pilots.
- Telemetry off by default; opt-in uploads allowlisted metadata only.
- CI/build/release packaging, checksum verification, strict TypeScript and pinned GitHub Actions.

## Local validation

```bash
npm ci
npm audit --audit-level=high
npm run check
```

`npm run test:firebase-emulator` additionally requires Java 21. GitHub CI provisions Java and runs the Auth + Firestore emulator suite.

## Production blockers / external acceptance

Repository tests do **not** prove production readiness. Before stable promotion:

1. create/select a real Firebase development project;
2. enable Email/Password Auth and deliberately provision/approve pilot users;
3. deploy reviewed Firestore rules/indexes and configure Firebase budget/abuse controls;
4. build the extension with the exact `VITE_AI_GATEWAY_ORIGIN` and registration disabled;
5. deploy the Cloudflare Worker + Durable Object with provider secrets, per-UID rate limit, global daily ceiling and pilot UID allowlist;
6. validate a real Google-signed Firebase ID token against the deployed Worker;
7. run Chrome MV3 browser E2E and controlled Facebook pilot;
8. verify delete-vs-update schedule conflicts on two browser profiles/devices;
9. verify Emergency Stop, telemetry opt-in, quotas and manual-submit boundary;
10. configure GitHub `main` protection and `production` Environment required reviewers;
11. promote only after pilot acceptance and explicit stable approval.

See `docs/STAGING_RUNBOOK.md` and `docs/PRODUCTION_HARDENING_0.14.md`.
