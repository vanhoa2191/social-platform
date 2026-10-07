# Social Platform / AutoTool v2

Campaign-centric UI, Chrome Extension MV3 runtime, optional AI Gateway and optional Supabase backend.

Current version: **0.7.0**

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
         +-- analytics events
```

The extension remains operational in **local-only mode** without Supabase.

## Safety model

- AI produces structured drafts; it does not freely control the browser.
- Review is explicit.
- Approved text can be prepared in the composer.
- Final social-platform submission remains manual.
- Account-context mismatches block execution.
- Emergency Stop, session limits and resource locks remain enforced.

## Security

- Supabase frontend access uses a publishable key + authenticated JWT + RLS.
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

## Package a release

After building:

```bash
npm run package:extension
```

For a stable package:

```bash
RELEASE_CHANNEL=stable npm run release:extension
```

Artifacts are written to `release/` and include a ZIP, SHA-256 checksum and metadata JSON.

## Supabase setup

1. Create or select a Supabase project.
2. Apply `supabase/migrations/20261007113000_initial_backend.sql`.
3. Copy `.env.example` and configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Add the extension callback URL to the Supabase Auth redirect allowlist when using magic links.

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
