# Social Platform / AutoTool v2

Campaign-centric UI, Chrome Extension MV3 runtime and optional server-side AI Gateway.

Current version: **0.4.0**

## Current capabilities

### Product UI
- dashboard
- campaign management
- accounts/profiles shell
- AI settings
- content library
- real persisted scheduler
- review queue
- real runtime logs
- analytics/settings shell

### Chrome runtime
- Manifest V3
- background service worker
- Facebook content script
- typed messages
- IndexedDB runtime database
- durable queue leases
- durable browser resource locks
- exponential retry/backoff
- persisted schedules
- chrome.storage safety/settings
- Emergency Stop
- session action limit

### Controlled review workflow
- find an open Facebook tab
- scan visible posts
- create AI drafts
- edit/regenerate/reject/approve
- prepare approved text in the composer
- verify inserted text
- user manually clicks **Gửi**

### AI Gateway
- local mock mode
- Cloudflare Worker bundle
- OpenAI-compatible / DeepSeek / Anthropic / Gemini adapters
- server-side provider keys
- prompt versions
- JSON validation
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

## Build extension

```bash
npm run build
```

Load `dist/` from `chrome://extensions` with **Load unpacked**.

## Build AI Gateway

```bash
npm run build:gateway
```

## Documentation

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/EXTENSION.md`
- `docs/AUTOMATION_MVP.md`
- `docs/AI_GATEWAY.md`
- `docs/QUEUE_SCHEDULER.md`

The product keeps final social-platform submission under explicit user control.
