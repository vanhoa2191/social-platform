# v0.14.0-beta — Production hardening

## Security and data consistency

- Schedule deletion tombstones now carry the local base revision. A stale device cannot silently delete a newer cloud schedule.
- Delete-vs-update conflicts are surfaced separately with explicit **Restore cloud** or **Confirm cloud deletion** choices.
- Firebase ID tokens are sent only to the exact `VITE_AI_GATEWAY_ORIGIN` compiled into the extension; arbitrary `*.workers.dev` URLs remain usable only with non-Firebase/dev auth.
- Account registration is disabled by default in controlled builds with `VITE_FIREBASE_ALLOW_REGISTRATION=false`.
- Paid AI providers require both a per-UID Durable Object minute quota and an explicit global daily request ceiling.
- Controlled pilots can restrict AI Gateway access to `ALLOWED_FIREBASE_UIDS`.
- Firestore rules add stricter field length/type/revision validation.

## Runtime hardening

- Emergency Stop cancels pending queue jobs (`SKIPPED`) and blocks new Run Now / direct enqueue requests until disabled.
- Review candidates of every state are removed after 30 days to limit local retention of captured Facebook text and generated drafts.
- Unimplemented `AI_DRAFT` / `REVIEW` queue job types were removed from the public runtime contract.
- TypeScript `strict` mode is enabled.
- Extension and gateway production bundles are minified and source maps are opt-in with `BUILD_SOURCEMAP=1`.

## CI and release

- GitHub checkout/setup-node/setup-java actions moved to current pinned v5 SHAs.
- `npm audit --audit-level=high` is now a CI/release gate.
- Stable release still requires live Firebase/Cloudflare/Chrome/Facebook acceptance and protected GitHub production approval.

## Still external / not proven by repository tests

- Real Firebase project deployment and budget controls.
- Real Google-signed Firebase ID token against deployed Cloudflare Worker.
- Durable Object behavior/billing in the owner Cloudflare account.
- Real Chrome MV3 + Facebook DOM end-to-end pilot.
- GitHub `main` branch protection and `production` Environment required reviewers must be configured in repository settings.
