# Firebase setup checklist

## 1. Local emulator first

You can validate the backend without a real Firebase project.

Requirements:

- Node.js
- Java 21+

Run:

```bash
npm run test:firebase-emulator
```

This runs **Auth and Firestore** emulators, Firestore Security Rules tests, and real Firebase SDK auth/CRUD/cross-user integration tests.

For application development against emulators, configure:

```env
VITE_FIREBASE_USE_EMULATORS=true
VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

For interactive app development, start the Firebase Auth + Firestore emulators separately with Firebase CLI. Do not use emulator credentials against a deployed Cloudflare Worker.

## 2. Create/select a real project

Create a Firebase development project in Firebase Console.

Recommended:
- separate dev project
- separate production project
- choose Firestore region deliberately
- do not use production data during pilot

## 3. Register Web App

Copy Firebase Web config into `.env`.

Required:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

## 4. Enable Authentication

Enable:

```text
Authentication
→ Sign-in method
→ Email/Password
```

The Chrome Extension uses `firebase/auth/web-extension`.

## 5. Create Firestore

Create Cloud Firestore, then deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 6. Verify production Security Rules

Use two different Firebase users and verify:

- User A can read/write `users/A/**`
- User A cannot read/write `users/B/**`
- unauthenticated access is rejected
- telemetry documents with extra content fields are rejected
- unknown subcollections are rejected

## 7. Build extension

```bash
npm run check
RELEASE_CHANNEL=beta npm run package:extension
```

Load `dist/` as an unpacked Chrome Extension.

## 8. Pilot

Open Settings → Firebase Backend & Sync.

1. Create/login with Firebase account.
2. Grant Firebase host permissions.
3. Sync Firestore.
4. Confirm browser instance document under your uid.
5. Create/edit a schedule and sync.
6. Test one cloud/local conflict.
7. Verify a second user cannot access the first user's tree.

## Optional later

Google Sign-In can be added using Firebase's Manifest V3 offscreen-document flow. It is not required for the current email/password pilot.


## Phase 13 staging

For exact origin restrictions, Durable Object quota and deploy-approval steps see [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md). Prepare a separate dev Firebase project and do not deploy to production without approval.
