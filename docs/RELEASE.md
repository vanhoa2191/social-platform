# Testing, pilot and release hardening — v0.8.0

## Automated validation

`npm run check` validates:

- lint
- unit tests
- Facebook adapter fixture integration
- IndexedDB v3 → v4 migration/data preservation
- schedule conflict policy
- pilot safeguards
- telemetry privacy helpers
- TypeScript
- dashboard production build
- Chrome Extension bundles
- extension manifest
- AI Gateway bundle

## Production bundle

Supabase/backend code is lazy-loaded from the Settings screen. This keeps the initial dashboard chunk significantly smaller and avoids loading the backend client before it is needed.

## Release packaging

Beta:

```bash
RELEASE_CHANNEL=beta npm run package:extension
```

Stable packaging is gated:

```bash
RELEASE_CHANNEL=stable \
RELEASE_APPROVED=1 \
RELEASE_TAG=v0.8.0 \
npm run package:extension
```

Stable packaging is rejected unless the tag exactly matches `v<manifest version>`.

Each package creates:

```text
release/autotool-v<version>-<channel>.zip
release/autotool-v<version>-<channel>.sha256
release/autotool-v<version>-<channel>.json
```

The packaged manifest receives `version_name=<version>-<channel>`.

The verifier checks the checksum, required extension files, version, channel and release metadata.

## GitHub Actions

PRs and feature/main pushes run CI and upload a beta artifact.

Tags matching `v*` run the stable workflow through the GitHub `production` environment. Configure required environment reviewers before production use.

## Pilot safeguards

Pilot mode defaults to enabled with low-volume limits. The Settings screen exposes a readiness checklist for runtime DB, Facebook account context, adapter health, safety controls, pilot limits, telemetry consent and release channel.

Telemetry remains opt-in and privacy-minimized.

## Remaining external validation

Live Supabase migration and RLS/security-advisor validation require a development Supabase project. The connected account currently exposes none.
