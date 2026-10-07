# Firebase setup checklist

## 1. Create/select project

Create a Firebase project in Firebase Console.

Recommended for development:
- separate dev project
- Firestore location close to your expected users
- keep production project separate from pilot/dev

## 2. Register Web App

Copy the Firebase Web configuration into `.env`.

Required:
- apiKey
- authDomain
- projectId
- appId

## 3. Enable Authentication

Enable:

```text
Authentication
→ Sign-in method
→ Email/Password
```

The current Chrome Extension flow uses `firebase/auth/web-extension`.

## 4. Create Firestore

Create a Cloud Firestore database.

Then deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 5. Verify Security Rules

Use two different Firebase Auth users and verify:

- User A can read/write `users/A/**`
- User A cannot read/write `users/B/**`
- unauthenticated reads/writes are rejected

## 6. Build extension

```bash
npm run check
RELEASE_CHANNEL=beta npm run package:extension
```

Load `dist/` as an unpacked Chrome Extension.

## 7. Pilot

Open Settings → Firebase Backend & Sync.

1. Create/login with a Firebase account.
2. Grant the requested Firebase host permissions.
3. Click **Đồng bộ Firestore**.
4. Confirm a browser instance document appears under your Firebase Auth uid.
5. Create/edit a schedule and sync again.
6. Verify only your own `users/{uid}` tree is accessible.

## Optional later

Google Sign-In can be added later. Firebase's official MV3 guidance requires an offscreen document for popup/redirect provider flows.
