# Testing & release hardening — v0.7.0

## Automated validation

`npm run check` now validates:

- lint
- unit tests
- Facebook adapter fixture integration tests
- IndexedDB v3 → v4 migration tests
- schedule sync conflict policy
- TypeScript
- dashboard production build
- Chrome Extension runtime bundles
- extension manifest verification
- AI Gateway bundle

## Facebook fixture tests

The adapter test suite uses a synthetic DOM to verify:

- account-context detection
- Feed/Group surface classification
- article scanning
- permalink extraction
- adapter health degradation when account evidence is missing
- approved-text insertion into a composer without submitting it

These tests are not a guarantee against future Facebook DOM changes, but they provide a reproducible compatibility baseline.

## IndexedDB upgrade

Runtime DB version is now **4**.

The migration adds a `meta` store containing schema metadata. Tests create a legacy v3 database, insert a job, upgrade it to v4 and verify that the job is preserved.

Runtime diagnostics now show both:

- IndexedDB database version
- schema metadata version

## Release packaging

After a successful build:

```bash
npm run package:extension
```

creates:

```text
release/autotool-v<version>-<channel>.zip
release/autotool-v<version>-<channel>.sha256
release/autotool-v<version>-<channel>.json
```

Default channel is `beta`.

Use:

```bash
RELEASE_CHANNEL=stable npm run release:extension
```

for a stable package.

The verifier checks:

- SHA-256 checksum
- required files in the ZIP
- manifest version
- release metadata consistency

## CI

GitHub Actions now:

- runs validation on pull requests and feature/main pushes
- packages a beta extension artifact in CI
- uploads ZIP/checksum/metadata as a workflow artifact

Tag pushes matching `v*` run the Release workflow and publish the packaged extension files to a GitHub Release.

## Sync conflict resolution

The Backend & Sync screen now reports exact schedule conflicts rather than only a count.

For each conflict, the user explicitly chooses:

- **Dùng bản cloud** — replace the local schedule with the newer cloud definition
- **Giữ bản local** — bump the local revision and sync it back

The system never silently overwrites a newer schedule.

## Remaining external validation

A live Supabase migration integration test is still pending because no Supabase project is currently connected to the account available in this session. The migration and RLS schema remain prepared in the repository.
