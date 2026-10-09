# Testing and release hardening — v0.14.0

## Validation

`npm run check` validates:

- lint
- unit tests
- Facebook adapter fixtures
- IndexedDB migrations
- sync conflict policy
- pilot safeguards
- telemetry privacy helpers
- TypeScript
- dashboard build
- Chrome Extension runtime bundles
- manifest verification
- AI Gateway bundle

## Backend bundle

Firebase/backend UI remains lazy-loaded from Settings so the dashboard does not load Firebase until needed.

## Beta package

```bash
RELEASE_CHANNEL=beta npm run package:extension
```

## Stable gate

```bash
RELEASE_CHANNEL=stable \
RELEASE_APPROVED=1 \
RELEASE_TAG=v0.14.0 \
npm run package:extension
```

Stable packaging is rejected without approval or with a mismatched tag.

## Artifacts

- ZIP
- SHA-256
- release metadata JSON

The packaged manifest is stamped with the release channel.

## Live backend validation

Repository tests validate Firebase config and application logic without a live project.

Before stable production use, deploy Firestore rules to a development Firebase project and verify:
- unauthenticated access denied
- user A can access only `users/A/**`
- user A cannot access `users/B/**`


### v0.14 stability gate

Staging needs live Firebase/Cloudflare controlled testing and release sign-off before any production tag. The release workflow's `RELEASE_APPROVED` must come from a manually configured GitHub Actions variable (not a hardcoded literal), and the `production` Environment must require reviewer approval. See `docs/STAGING_RUNBOOK.md`.
