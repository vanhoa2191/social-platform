# Social Platform / AutoTool v2

Campaign-centric UI, Chrome Extension MV3 runtime, optional AI Gateway and optional Supabase backend.

Current version: **0.8.0-beta**

## Architecture

```text
Chrome Extension
   |
   +-- Local runtime
   |     +-- queue / locks
   |     +-- review candidates
   |     +-- schedules
   |     +-- account context
   |     +-- IndexedDB schema v4
   |     +-- pilot safeguards
   |
   +-- AI Gateway
   |     +-- OpenAI / DeepSeek / Claude / Gemini
   |
   +-- Supabase Backend (optional)
         +-- Auth
         +-- campaigns
         +-- AI profiles
         +-- schedule definitions
         +-- browser instances
         +-- opt-in analytics metadata
```

The extension remains operational in **local-only mode** without Supabase.

## Safety model

- AI produces structured drafts; it does not freely control the browser.
- Review is explicit.
- Approved text can be prepared in the composer.
- Final social-platform submission remains manual.
- Account-context mismatches block execution.
- Emergency Stop, session limits and resource locks remain enforced.
- Pilot mode is enabled by default with lower workload caps.

## Telemetry

Telemetry is **off by default**.

When explicitly enabled, the backend receives only normalized event metadata such as category, level, event id and timestamp. Post content, generated comments, runtime event messages and diagnostic detail text are excluded.

Events created before telemetry consent are not uploaded later after opt-in.

## Security

- Supabase frontend access uses a publishable key + authenticated JWT + RLS.
- The extension asks for the configured Supabase host permission from a user-triggered login/sync action.
- Never expose a Supabase service-role/secret key in the extension.
- AI provider API keys stay server-side in the AI Gateway.

## Development

```bash
npm install
npm run dev
```

## Validate

```bash
npm run check
```

## Build extension

```bash
npm run build
```

Load `dist/` from `chrome://extensions` using **Load unpacked**.

## Package beta

```bash
RELEASE_CHANNEL=beta npm run package:extension
```

## Stable release gate

Stable packaging requires both explicit approval and a tag that matches the manifest version:

```bash
RELEASE_CHANNEL=stable \
RELEASE_APPROVED=1 \
RELEASE_TAG=v0.8.0 \
npm run package:extension
```

The GitHub tag workflow uses the `production` environment. Configure required reviewers on that environment before production use.

Artifacts include:

- ZIP
- SHA-256 checksum
- release metadata JSON

## Supabase setup

1. Create or select a Supabase project.
2. Apply `supabase/migrations/20261007113000_initial_backend.sql`.
3. Copy `.env.example` and configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Add the extension callback URL to the Supabase Auth redirect allowlist.

No live project is currently attached through the connected Supabase account.

## Documentation

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/EXTENSION.md`
- `docs/AUTOMATION_MVP.md`
- `docs/AI_GATEWAY.md`
- `docs/QUEUE_SCHEDULER.md`
- `docs/PLATFORM_ADAPTERS.md`
- `docs/BACKEND.md`
- `docs/RELEASE.md`
- `docs/PILOT.md`
