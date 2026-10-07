# Controlled pilot — v0.8.0

## Objective

The pilot is designed to validate browser compatibility and workflow reliability with a very small workload before any broader rollout.

The product continues to keep final social-platform submission under explicit user control.

## Default pilot safeguards

Pilot mode is enabled by default.

Default caps:

- 5 posts per scan/review run
- 10 prepared actions per browser session
- final submit remains manual
- account-context verification remains mandatory
- resource locks remain mandatory
- Emergency Stop remains available

The limits can be adjusted from **Settings → Pilot Readiness**.

## Pilot readiness checks

The UI checks:

- Chrome Extension runtime is active
- IndexedDB schema is current
- Facebook account context is verified
- Facebook adapter health
- Emergency Stop state
- effective pilot workload caps
- telemetry consent state
- release channel

Warnings do not automatically bypass safeguards.

## Telemetry policy

Telemetry is **off by default**.

When the user opts in, cloud analytics receives only:

- event id
- category
- level
- timestamp
- telemetry schema version

The following are deliberately excluded:

- Facebook post content
- generated comment text
- runtime event message
- runtime event detail
- page title
- profile label
- profile URL

Disabling telemetry stops future event uploads. Local runtime logs remain local.

## Pilot sequence

Recommended sequence for each test account:

1. Open Facebook and confirm the correct account.
2. Open AutoTool Settings.
3. Run Pilot Readiness.
4. Require no BLOCKED items.
5. Keep Pilot Mode enabled.
6. Scan a small visible set of posts.
7. Review generated drafts manually.
8. Approve one draft.
9. Prepare it in the composer.
10. Confirm the extension does not submit automatically.
11. Verify runtime logs.
12. Stop immediately if the adapter becomes DEGRADED after a Facebook DOM change.

## Beta → stable promotion

A stable package is blocked unless:

- all automated checks pass
- release channel is `stable`
- `RELEASE_APPROVED=1`
- release tag exactly matches `v<manifest version>`

GitHub's stable workflow uses the `production` environment. Repository maintainers should configure required reviewers for that environment before production use.

## External blockers

Live Supabase migration/RLS validation still requires a real development Supabase project. The connected account currently exposes no project, so no live database changes are performed automatically.
