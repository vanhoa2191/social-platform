# Social Platform / AutoTool v2

Campaign-centric UI, Chrome Extension MV3 runtime, optional AI Gateway and Firebase cloud backend.

Current version: **0.9.0-beta**

## Architecture

```text
Chrome Extension
   |
   +-- Local runtime
   |     +-- queue / locks
   |     +-- review candidates
   |     +-- schedules
   |     +-- account context
   |     +-- IndexedDB
   |     +-- pilot safeguards
   |
   +-- AI Gateway
   |     +-- OpenAI / DeepSeek / Claude / Gemini
   |
   +-- Firebase (optional)
         +-- Authentication
         +-- Cloud Firestore
         +-- browser instances
         +-- campaigns
         +-- AI profiles
         +-- schedule definitions
         +-- opt-in analytics metadata
```

The extension remains fully usable in **local-only mode** without Firebase.

## Safety model

- AI generates structured drafts; it does not freely control the browser.
- Review is explicit.
- Approved text can be prepared in the composer.
- Final Facebook submission remains manual.
- Account-context mismatches block execution.
- Emergency Stop, session limits and resource locks are enforced.
- Pilot mode defaults to lower workload caps.

## Firebase

Current authentication:
- Email/password sign up
- Email/password sign in
- Password reset
- Sign out

Chrome Extension authentication uses Firebase's MV3-compatible `firebase/auth/web-extension` entry point.

Cloud documents are nested under:

```text
users/{uid}/...
```

Firestore Security Rules restrict each user to their own tree.

## Firebase setup

1. Create/select a Firebase project.
2. Register a Web App.
3. Enable **Authentication → Email/Password**.
4. Create Cloud Firestore.
5. Copy `.env.example` to your environment and add Firebase Web config.
6. Deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

See `docs/FIREBASE_SETUP.md`.

## Telemetry

Telemetry is **off by default**.

After explicit opt-in, Firestore receives normalized event metadata only. It does not receive Facebook post content, generated comments, runtime event messages/details, profile labels or profile URLs.

## Development

```bash
npm install
npm run dev
```

## Validate

```bash
npm run check
```

## Build extension

```bash
npm run build
```

Load `dist/` from `chrome://extensions` using **Load unpacked**.

## Package beta

```bash
RELEASE_CHANNEL=beta npm run package:extension
```

## Stable gate

```bash
RELEASE_CHANNEL=stable \
RELEASE_APPROVED=1 \
RELEASE_TAG=v0.9.0 \
npm run package:extension
```

## Documentation

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/EXTENSION.md`
- `docs/AUTOMATION_MVP.md`
- `docs/AI_GATEWAY.md`
- `docs/QUEUE_SCHEDULER.md`
- `docs/PLATFORM_ADAPTERS.md`
- `docs/BACKEND.md`
- `docs/FIREBASE_SETUP.md`
- `docs/RELEASE.md`
- `docs/PILOT.md`
