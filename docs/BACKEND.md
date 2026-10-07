# Backend data layer — v0.8.0

## Design goal

AutoTool remains **local-first**. Browser execution state stays local: queue, locks, review candidates, account context, session limits and Emergency Stop.

Supabase/PostgreSQL is optional and stores data that benefits from cloud persistence: authentication, browser instances, campaign definitions, AI profiles, schedule definitions and explicitly opted-in analytics metadata.

## Security model

Client applications use:

- Supabase project URL
- Supabase publishable key
- authenticated user JWT
- Row Level Security

Never put a Supabase service-role / secret key in the Chrome Extension. AI provider secrets remain in the separate AI Gateway.

When running as a Chrome Extension, login/sync requests the configured Supabase origin through Chrome optional host permissions from an explicit user action.

## Environment

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

If either value is missing, the product stays in local-only mode.

## Schema

Migration:

```text
supabase/migrations/20261007113000_initial_backend.sql
```

Tables:

- `profiles`
- `browser_instances`
- `campaigns`
- `ai_profiles`
- `schedule_definitions`
- `analytics_events`

Every client-facing table has RLS enabled.

## Browser instance registration

Each installation uses a stable random `device_key`. Cloud metadata is intentionally minimal and no longer uploads the browser user-agent or language.

## Schedule sync

Schedule sync compares local and remote revisions before writing.

- local >= remote → local can be pushed
- remote > local → conflict
- conflict requires an explicit choice in the UI
- cloud never silently overwrites local
- local never silently overwrites newer cloud state

## Analytics telemetry

Telemetry is **off by default**.

When a user opts in, only normalized metadata is uploaded:

- local event id
- event category
- event level
- timestamp
- telemetry schema version

Post content, generated comments, event messages and event detail fields are excluded.

A consent timestamp is stored locally. Events created before the current consent window are excluded even if the user later enables telemetry.

## Authentication

The Settings screen supports Supabase email magic-link authentication. The extension callback URL must be present in the Supabase Auth redirect allowlist.

## Current deployment state

No Supabase project is currently exposed by the connected account. The migration is ready but has not been applied to a live development project.

Project creation is not performed automatically because it can have billing/resource implications.
