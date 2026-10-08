# v0.12.0-beta — Production hardening

## Changes
- Facebook adapter: identity prefers canonical permalink; waits for composer via MutationObserver. No automatic final Submit.
- IndexedDB retention: success jobs after 14 days, failed/skipped and terminal reviews after 30 days, runtime events at most 10,000 / 30 days. Active jobs and pending reviews are preserved.
- Extension host permissions narrowed to workers.dev/Firebase API and localhost test origins. Custom production gateway domains need an explicit allowlist update.
- AI Gateway verifies Firebase ID tokens (RS256, Firebase securetoken issuer/audience, subject and auth_time). Settings allow Firebase or legacy shared token for dev.
- Gateway CORS requires ALLOWED_ORIGINS; in-memory rate limit is **not distributed**.
- AI Profiles and Content Library now persist to Firebase. They are standalone metadata/catalog features, not automatically applied to runtime draft generation.
- Analytics displays real local counts (recent events, review status, enabled schedules), not Facebook engagement metrics.
- CI actions pinned to commit hashes. Stable release requires manually configured RELEASE_APPROVED repo variable as well as production Environment reviewers.

## Deployment requirements
1. Configure Firebase environment variables via .env.local, enable Email/Password authentication and Firestore.
2. **Before deployment** test firestore.rules with Java 21 via npm run test:firebase-emulator, then deploy rules/indexes.
3. Deploy Cloudflare Worker with FIREBASE_PROJECT_ID and GATEWAY_AUTH_MODE=firebase. Put AI_API_KEY in Worker secrets; do not store model keys in extension.
4. Configure Cloudflare server-side distributed quotas before scaling, test real Facebook adapter in a controlled account session. Never auto-submit.
5. In GitHub Settings, configure production Environment required reviewers and Actions variable RELEASE_APPROVED=1 only once approved.

## Known limitations
- Firestore rules emulator could not run in Cloud Harness workspace lacking Java. Production rollout must wait for an emulator pass.
- AI Profiles and Content Library CRUD are not yet wired as controls for AI runtime (default comment-v2 still used).
- No live Facebook E2E conducted; DOM may differ.
- Analytics summarizes up to 500 recent local events, not comprehensive historical/remote reporting.
- Cloudflare Worker in-memory rate limit is per instance only.
