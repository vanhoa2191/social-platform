# Social Platform / AutoTool v2

Campaign-centric UI, Chrome Extension MV3 runtime and optional server-side AI Gateway.

Current version: **0.3.0**

## Implemented

### Product UI
- dashboard
- campaign management and 5-step wizard
- accounts & profiles
- AI profiles
- content library
- scheduler
- queue/review UI
- logs and analytics shell
- settings

### Chrome runtime
- Manifest V3
- background service worker
- Facebook content script
- typed runtime messaging
- IndexedDB queue/review storage
- chrome.storage settings
- Emergency Stop
- session action limit
- optional gateway origin permission

### Controlled automation
- scan visible Facebook posts
- create AI drafts
- edit/regenerate/reject/approve drafts
- prepare approved text in the Facebook composer
- verify inserted text
- user manually clicks **Gửi**

### AI Gateway
- local mock mode
- Cloudflare Worker bundle
- OpenAI-compatible / DeepSeek / Anthropic / Gemini provider adapters
- server-side API keys
- prompt versions
- JSON validation
- health endpoint
- token/cost metadata

## Development

```bash
npm install
npm run dev
```

## Validate

```bash
npm run check
```

This runs lint, unit tests, the dashboard build, extension runtime bundling/verification and AI gateway bundling.

## Build Chrome Extension

```bash
npm run build
```

Load `dist/` from `chrome://extensions` using **Load unpacked**.

## Build AI Gateway

```bash
npm run build:gateway
```

The Worker bundle is created at `dist-gateway/worker.js`. See `wrangler.toml.example` and `docs/AI_GATEWAY.md`.

## Docs

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/EXTENSION.md`
- `docs/AUTOMATION_MVP.md`
- `docs/AI_GATEWAY.md`

The current product intentionally keeps final social-platform submission under user control.
