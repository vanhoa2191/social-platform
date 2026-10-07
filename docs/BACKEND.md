# Firebase backend — v0.11.0

## Architecture

AutoTool remains **local-first**.

Local Chrome runtime keeps:
- queue
- locks
- review candidates
- session limits
- Emergency Stop
- account context
- execution state

Firebase is used only for cloud data:
- Firebase Authentication
- browser instance registration
- campaigns
- AI profiles
- schedule definitions
- opt-in analytics metadata

AI provider keys remain in the separate AI Gateway.

## Chrome Extension authentication

The extension uses the official Firebase Chrome Extension flow for Manifest V3.

Email/password authentication is implemented through the Firebase Web SDK's Chrome-extension entry point:

```ts
firebase/auth/web-extension
```

This avoids needing an offscreen OAuth document for the current login flow.

Google popup/redirect login can be added later, but Firebase requires an offscreen document for popup/redirect based providers in MV3.

## Environment

Copy `.env.example` and configure:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_STORAGE_BUCKET=
```

The first four values are required.

If they are missing, AutoTool automatically stays in local-only mode.

## Firestore model

All user cloud data is nested under:

```text
users/{uid}
├── browserInstances/{deviceKey}
├── campaigns/{campaignId}
├── aiProfiles/{profileId}
├── schedules/{localScheduleId}
└── analyticsEvents/{localEventId}
```

This makes ownership rules simple and explicit.

## Security Rules

`firestore.rules` allows a signed-in user to access only their own `users/{uid}` tree.

Deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Do not treat Firebase Web config values as authorization. Firestore Security Rules are the authorization boundary.

## Extension host permissions

Firebase SDK requests can reach:
- the configured Firebase Auth domain
- `identitytoolkit.googleapis.com`
- `securetoken.googleapis.com`
- `firestore.googleapis.com`
- `www.googleapis.com`

AutoTool requests these host permissions only after the user explicitly presses a Firebase login/sync action.

## Authentication setup

In Firebase Console:

1. Open **Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Create a Web App and copy its Web config into `.env`.
4. Create a Firestore database.
5. Deploy `firestore.rules`.

The current implementation supports:
- create account
- sign in
- password reset
- sign out

## Schedule sync

Each local schedule is stored in Firestore using its local schedule id as the document id.

Conflict policy:

- local revision > remote → local may be pushed
- local revision == remote → local may be pushed idempotently
- remote revision > local → conflict
- conflict requires explicit **Dùng bản Firestore** or **Giữ bản local**

There is no silent overwrite.

## Telemetry

Telemetry remains **off by default**.

After explicit opt-in, Firestore receives only:
- local event id
- browser instance id
- category
- level
- timestamp
- telemetry schema version

It does not receive:
- post content
- generated comments
- runtime event messages
- runtime event detail text
- profile URLs
- profile labels

Events created before the current consent timestamp are not uploaded later.

## Deployment state

The repository is Firebase-ready, but no Firebase project is connected through a ChatGPT Firebase connector in this environment.

Project creation and billing-plan decisions remain user-controlled.
