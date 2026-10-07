# Controlled pilot — v0.10.0

## Objective

Validate the extension on a small workload before broader rollout.

Final social-platform submission remains under explicit user control.

## Default safeguards

Pilot mode is enabled by default:

- 5 posts per scan/review run
- 10 prepared actions per browser session
- final submit remains manual
- account-context verification required
- resource locks required
- Emergency Stop available

## Pilot Readiness

Settings checks:

- Chrome Extension runtime
- IndexedDB schema
- Facebook account context
- Facebook adapter health
- safety controls
- pilot caps
- telemetry state
- release channel

## Firebase backend pilot

When Firebase is configured:

1. create/sign in to a Firebase account;
2. grant the requested Firebase origins;
3. sync Firestore;
4. verify `users/{uid}/browserInstances/{deviceKey}`;
5. sync schedules;
6. test a conflict resolution;
7. verify a second Firebase user cannot access the first user's tree.

## Telemetry

Telemetry is off by default.

After opt-in, only normalized metadata is uploaded to:

```text
users/{uid}/analyticsEvents/{localEventId}
```

No post content, generated comment, runtime message/detail, page title, profile label or profile URL is included.

Events created before consent are never uploaded later.

## Real Facebook pilot

Recommended sequence:

1. Open an approved test Facebook account.
2. Run Pilot Readiness.
3. Require no BLOCKED checks.
4. Scan a small visible set of posts.
5. Review AI drafts manually.
6. Approve one draft.
7. Prepare it in composer.
8. Confirm AutoTool does not submit automatically.
9. Inspect runtime logs.
10. Stop if adapter health becomes DEGRADED after a Facebook UI change.
