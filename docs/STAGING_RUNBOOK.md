# Phase 13 — Firebase + Cloudflare staging pilot

This is a **runbook**, not evidence of any real cloud deployment. No production services should be provisioned or charged without the repository owner's approval.

## 1. Accounts and staging scope

Use a user-owned **Firebase development project** with a separate Firestore database from production; choose the region, enable Email/Password Auth and register a Firebase Web App. Prepare a **Cloudflare account** with Workers and Durable Objects support. Provider API keys must be held in Cloudflare secrets, not in Git, browser local storage, or client environment variables.

Have two test Firebase users and one intentionally controlled Facebook session. No unattended final posting.

## 2. Local verified checks

From the repository root, with Node 22 and Java 21 installed:

```bash
npm ci
npm run check
npm run test:firebase-emulator
```

The Firebase Emulator command starts **Auth and Firestore**, then runs Rules + real Firebase SDK integration tests (Auth account registration, CRUD, ownership separation and logout). This does **not** deploy cloud infrastructure.

## 3. User-owned Firebase settings

```bash
cp .env.example .env.staging.local
```

Fill `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` with the new **dev** Web App settings. Set `VITE_FIREBASE_USE_EMULATORS=false`. `.env.staging.local` must never be committed.

After reviewing the Security Rules in this repository, use the Firebase CLI with the development project deliberately selected:

```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes --project YOUR_DEV_PROJECT_ID
```

These deployment commands require a real project and should run only with approval.

## 4. Build and identify Chrome Extension

Load the Web config into the environment before building. Only `VITE_FIREBASE_*` browser-safe values belong here; no AI provider secret keys.

```bash
set -a
. ./.env.staging.local
set +a
npm run build
```

Load `dist/` unpacked at `chrome://extensions`. Copy the **actual installed 32-character extension ID** shown by Chrome. Use a separate Chrome profile for each Firebase UID; existing local runtime data becomes bound to the first account it syncs.

## 5. Cloudflare staging gateway

```bash
cp wrangler.toml.example wrangler.staging.toml
```

Edit only the private `wrangler.staging.toml`:
- Unique Worker name; `GATEWAY_AUTH_MODE="firebase"`; `FIREBASE_PROJECT_ID` identical to the dev Firebase project.
- `ALLOWED_ORIGINS="chrome-extension://YOUR_32_CHAR_EXTENSION_ID"` (**exact** Chrome origin; no wildcard).
- `AI_PROVIDER` and `AI_MODEL` appropriate for approved testing.
- Keep `[[durable_objects.bindings]] RATE_LIMITER` and the SQLite DO migration `v1` for user-scoped, transactional quotas. Durable Objects may incur account charges.
- Restrict `RATE_LIMIT_PER_MINUTE` for the pilot (e.g. 5).
- When using `AI_PROVIDER="mock"`, explicitly use `ALLOW_MOCK_PILOT=1` for the preflight; it does not contact a paid provider.

Run **offline preflight**:

```bash
node scripts/preflight-staging.mjs .env.staging.local wrangler.staging.toml
npm run build:gateway
npx wrangler@4 deploy --dry-run --config wrangler.staging.toml
```

After approval, add provider secret and deploy:

```bash
npx wrangler@4 secret put AI_API_KEY --config wrangler.staging.toml
npx wrangler@4 deploy --config wrangler.staging.toml
```

Never commit API keys. Firebase Emulator-issued tokens are **not accepted** by the production Google JWKS verification; use a real development Firebase account for deployed Worker tests.

## 6. Acceptance checklist

- Log in to the extension through Firebase **dev** Email/Password Auth. Confirm Firestore owner-scoped reads/writes and Chrome permissions.
- Register browser instance, create/edit a schedule, sync twice, resolve a revision conflict; verify deletion/tombstone behavior.
- Confirm user B cannot read user A's cloud data, and the same Chrome profile refuses to sync user A's local workflow data to B.
- Confirm telemetry stays **off** until opt-in and only whitelisted metadata is sent.
- Verify a real Firebase ID token can reach `GET /health` and `POST /v1/comment`; invalid/expired tokens are rejected.
- Confirm DO per-UID quota blocks the configured threshold across repeated real Worker requests.
- Test one Facebook article-local composer with explicit review. **Do not automate final Submit**.
- Verify Emergency Stop, session limits, no duplicate/ambiguous composer and safe account context.
- Record the pilot date, version, anonymized results and decision before seeking stable release.

## 7. Stable release controls

GitHub `production` Environment must have **required reviewers**. Configure repository/organization variable `RELEASE_APPROVED=1` only when release has been approved, and tag exactly `v0.13.0`. CI and release workflows must succeed with Java 21 Firebase Emulator tests and verified extension checksums. Do not tag a release before the staging acceptance checklist has been completed.

**Not validated yet:** live Firebase project, Cloudflare deployed Durable Object billing / quota, actual Firebase-issued JWT against Google JWKS, and real Facebook browser E2E. Do not label this implementation production-ready solely from local tests.
