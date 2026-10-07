# Firebase security validation — v0.10.0

## Purpose

The cloud backend is optional, but when enabled it must enforce tenant isolation independently of UI code.

The repository now includes Firestore Security Rules tests that run against the Firebase Emulator Suite.

## Security properties under test

The emulator suite verifies:

- an authenticated user can access only their own `users/{uid}/...` tree
- cross-user reads are denied
- cross-user writes are denied
- unauthenticated reads are denied
- schedule document ids must match `localScheduleId`
- browser instance document ids must match `deviceKey`
- telemetry payloads may contain only `schemaVersion`
- unknown user subcollections are denied by default

This means the client cannot silently introduce a new cloud collection without an explicit Security Rules change.

## Run locally

Java 21+ is required by the Firestore emulator.

```bash
npm run test:firebase-emulator
```

The command launches Firestore locally using:

```text
project: demo-autotool
host:    127.0.0.1
port:    8080
```

No real Firebase project is contacted.

## CI

GitHub Actions installs Java 21 and runs:

```bash
npm run test:firebase-emulator
```

on pull requests, feature branches, main and stable tag releases.

A release cannot reach the package step if Firestore Security Rules tests fail.

## Emulator app mode

The application itself can use local Firebase emulators by setting:

```env
VITE_FIREBASE_USE_EMULATORS=true
VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

The extension then requests only the emulator origins for Firebase backend traffic.

## Production rule model

Allowed collections are explicit:

- `browserInstances`
- `campaigns`
- `aiProfiles`
- `schedules`
- `analyticsEvents`

Everything else under `users/{uid}` is denied by default.

## Telemetry privacy enforcement

Telemetry privacy is enforced twice:

1. application code strips content/message/detail fields;
2. Firestore Security Rules reject telemetry payloads containing fields other than `schemaVersion`.

This prevents a future client regression from uploading private runtime text without also changing and reviewing the server-side authorization policy.
