# Social Platform / AutoTool v2

Campaign-centric Chrome Extension MV3 runtime with optional AI Gateway and Firebase cloud backend.

Current version: **0.12.0-beta**

## Architecture

```text
Chrome Extension
├── Local runtime
│   ├── queue / locks
│   ├── review candidates
│   ├── schedules
│   ├── account context
│   ├── IndexedDB
│   └── pilot safeguards
├── AI Gateway
│   └── OpenAI / DeepSeek / Claude / Gemini
└── Firebase (optional)
    ├── Authentication
    ├── Cloud Firestore
    ├── browser instances
    ├── campaigns
    ├── AI profiles
    ├── schedules
    └── opt-in analytics metadata
```

AutoTool remains usable in **local-only mode** without Firebase.

## Safety model

- AI creates structured drafts; it does not freely control the browser.
- Review is explicit.
- Approved text can be prepared in the composer.
- Final Facebook submission remains manual.
- Account-context mismatches block execution.
- Emergency Stop, session limits and resource locks are enforced.
- Pilot mode defaults to low-volume limits.

## Firebase

Authentication currently supports:

- Email/password account creation
- Email/password sign-in
- Password reset
- Sign-out

Chrome Extension Auth uses `firebase/auth/web-extension`.

Firestore documents live under:

```text
users/{uid}/...
```

Security Rules allow only the owner and explicitly allowlisted subcollections.

## Firebase Emulator Suite

Firestore Security Rules are tested without a real cloud project:

```bash
npm run test:firebase-emulator
```

Java 21+ is required locally. GitHub Actions installs Java automatically.

Application emulator mode:

```env
VITE_FIREBASE_USE_EMULATORS=true
VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

## Real Firebase setup

1. Create/select Firebase project.
2. Register Web App.
3. Enable Email/Password Auth.
4. Create Firestore.
5. Add Firebase Web config to environment.
6. Deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

See `docs/FIREBASE_SETUP.md` and `docs/FIREBASE_SECURITY.md`.

## Telemetry

Telemetry is **off by default**.

After explicit opt-in, Firestore receives only normalized metadata. Firestore Rules additionally reject telemetry payloads that attempt to include arbitrary content fields.

## Development

```bash
npm install
npm run dev
```

## Validate

```bash
npm run check
```

## Package beta

```bash
RELEASE_CHANNEL=beta npm run package:extension
```

## Stable gate

```bash
RELEASE_CHANNEL=stable \
RELEASE_APPROVED=1 \
RELEASE_TAG=v0.12.0 \
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
- `docs/FIREBASE_SECURITY.md`
- `docs/RELEASE.md`
- `docs/PILOT.md`


### Local-first account isolation (v0.12)

The **first manual cloud sync** binds this Chrome profile's local queue, schedules and runtime event data to one Firebase UID. Signing into another Firebase account on the same Chrome profile does **not** transfer that local data; syncing is blocked to avoid cross-account disclosure. Use a separate Chrome profile for another Firebase user. Event cursors are UID-scoped and telemetry requires opt-in. Firebase Auth and Firestore Security Rules protect cloud data, but still require verification against a real project before rollout.

The retired cloud `campaigns` repository/model is disabled; supported pilot workflows use local schedules plus explicit Firebase schedule sync. AI Profiles and Content Library are cloud-backed catalogs, not yet connected as runtime generation configuration.
