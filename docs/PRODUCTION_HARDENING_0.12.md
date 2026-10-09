# v0.12.0-beta — Production hardening

## Changes
- Facebook adapter: identity prefers canonical permalink; waits for composer via MutationObserver. No automatic final Submit.
- IndexedDB retention: success jobs after 14 days, failed/skipped and terminal reviews after 30 days, runtime events at most 10,000 / 30 days. Active jobs and pending reviews are preserved.
- Extension host permissions narrowed to workers.dev/Firebase API and localhost test origins. Custom production gateway domains need an explicit allowlist update.
- AI Gateway verifies Firebase ID tokens (RS256, Firebase securetoken issuer/audience, subject and auth_time). Settings allow Firebase or legacy shared token for dev.
- Gateway CORS requires ALLOWED_ORIGINS; in-memory rate limit is **not distributed**.
- AI Profiles and Content Library now persist to Firebase. They are standalone metadata/catalog features, not automatically applied to runtime draft generation.
- Analytics displays real local counts (recent events, review status, enabled schedules), not Facebook engagement metrics.
- GitHub Actions workflow SHA pinning remains outstanding: available GitHub credentials cannot push workflow updates. Configure production Environment required reviewers before publishing stable releases.

## Deployment requirements
1. Configure Firebase environment variables via .env.local, enable Email/Password authentication and Firestore.
2. Validate firestore.rules with Java 21 via `npm run test:firebase-emulator` (9/9 emulator cases passed in isolated workspace), then review/deploy rules and indexes to the selected Firebase project.
3. Deploy Cloudflare Worker with FIREBASE_PROJECT_ID and GATEWAY_AUTH_MODE=firebase. Put AI_API_KEY in Worker secrets; do not store model keys in extension.
4. Configure Cloudflare server-side distributed quotas before scaling, test real Facebook adapter in a controlled account session. Never auto-submit.
5. In GitHub Settings, configure production Environment required reviewers and Actions variable RELEASE_APPROVED=1 only once approved.

## Known limitations
- Firestore rules emulator was run using user-space Temurin Java 21 (ARM64): **9/9 tests passed**; no real Firebase project was connected or deployed.
- AI Profiles and Content Library CRUD are not yet wired as controls for AI runtime (default comment-v2 still used).
- No live Facebook E2E conducted; DOM may differ.
- Analytics summarizes up to 500 recent local events, not comprehensive historical/remote reporting.
- Cloudflare Worker in-memory rate limit is per instance only.


## Audit follow-up — October 9, 2026
- Added Firestore Emulator tests for schedule interval/maxPosts/hour constraints and monotonic revisions, owner-only AI Profile CRUD, Content Library CRUD, and rejection of retired cloud campaigns.
- Removed unused cloud `campaigns` repository and permissive Firestore policy; beta workflows use schedules.
- Added AI Profile deletion UI and removed unused delay/review setting fields that did not affect the runtime.
- Cloud synchronization now claims the local browser data to the first Firebase UID. Mismatched-user sync and conflict resolution are blocked. Telemetry watermark cursors are UID-scoped; do not migrate global legacy cursors between users.
- **Remaining:** Cloudflare rate limiting is per worker isolate (not globally enforced), real Firebase and live Facebook end-to-end testing, GitHub workflow SHA pinning and production approval configuration; app-side catalogs are not yet selected by runtime AI strategy.
