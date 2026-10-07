# Social Platform / AutoTool v2

Campaign-centric UI, Chrome Extension MV3 runtime, optional AI Gateway and optional Supabase backend.

Current version: **0.6.0**

## Architecture

```text
Chrome Extension
   |
   +-- Local runtime
   |     +-- queue / locks
   |     +-- review candidates
   |     +-- schedules
   |     +-- account context
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

## Security

- Supabase frontend access uses a publishable key plus authenticated JWT and RLS.
- Never expose a Supabase service-role/secret key in the extension.
- AI provider API keys remain server-side in the AI Gateway.
- Final social-platform submission remains under explicit user control.

## Development

```bash
npm install
npm run dev
```

## Validate

```bash
npm run check
```

## Supabase setup

1. Create or select a Supabase project.
2. Apply:
   `supabase/migrations/20261007113000_initial_backend.sql`
3. Copy `.env.example` and provide:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Add your Chrome Extension callback URL to the Supabase Auth redirect allowlist if using magic links.

No service-role key is needed by the extension.

## Build extension

```bash
npm run build
```

Load `dist/` from `chrome://extensions` using **Load unpacked**.

## Documentation

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/EXTENSION.md`
- `docs/AUTOMATION_MVP.md`
- `docs/AI_GATEWAY.md`
- `docs/QUEUE_SCHEDULER.md`
- `docs/PLATFORM_ADAPTERS.md`
- `docs/BACKEND.md`
