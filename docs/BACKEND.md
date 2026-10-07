# Backend data layer — v0.6.0

## Design goal

AutoTool remains **local-first**.

The Chrome Extension keeps browser execution state locally:

- queue
- locks
- review candidates
- session action limits
- Emergency Stop
- account context

Supabase/PostgreSQL is used only for data that benefits from cloud persistence:

- authentication
- browser-instance registration
- campaign definitions
- AI profile definitions
- schedule definitions
- normalized analytics events

The browser runtime must continue working when the backend is unavailable.

## Security model

Client applications use:

- Supabase project URL
- Supabase publishable key
- authenticated user JWT
- Row Level Security

Never put a Supabase service-role / secret key in the Chrome Extension.

Provider API keys for OpenAI, Claude, DeepSeek or Gemini remain in the separate AI Gateway.

## Environment

Copy:

```text
.env.example
```

to your local environment and configure:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The app automatically stays in local-only mode if either value is missing.

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

Every client-facing table has Row Level Security enabled.

## Browser instance registration

Each extension installation creates a stable random `device_key`.

After authentication, sync performs an upsert into:

```text
browser_instances
```

The cloud record stores:

- device key
- display name
- extension version
- last-seen timestamp
- small non-sensitive environment metadata

## Schedule sync

Schedule sync uses `local_schedule_id` and a local `updatedAt` timestamp as a revision.

Current conflict policy:

1. read remote revisions first;
2. if local revision >= remote revision, push local;
3. if remote revision > local revision, do not overwrite it;
4. report the conflict in the UI.

Operational execution still uses the local schedule. Phase 8 can add an explicit conflict-resolution UI before importing remote changes.

## Analytics event sync

The extension reads normalized runtime events and sends only events newer than a local watermark.

Each row includes a stable `local_event_id`.

The database has a unique constraint on:

```text
(user_id, browser_instance_id, local_event_id)
```

so retrying an already-sent event is idempotent.

## Authentication

The Settings screen supports Supabase email magic-link authentication when the backend is configured.

For an unpacked Chrome Extension, the final extension URL must be added to the Supabase Auth redirect allowlist before magic-link redirect can complete.

## Current deployment state

The repository includes the full migration and client integration, but no Supabase project is automatically created.

Creating a new project may have billing implications, so project creation is intentionally not performed by the build workflow without explicit user confirmation.
