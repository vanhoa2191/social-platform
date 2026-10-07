# Social Platform / AutoTool v2

Campaign-centric UI, Chrome Extension MV3 runtime and optional server-side AI Gateway.

Current version: **0.5.0**

## Implemented

### Chrome runtime
- Manifest V3
- background service worker
- typed runtime messaging
- IndexedDB queue/review/schedule/event storage
- durable job leases
- per-account browser resource locks
- retry/backoff
- Emergency Stop
- session action limits

### Facebook platform adapter
- centralized DOM selectors
- Feed / Group / Page / Post surface detection
- visible article scanning
- account-context detection
- adapter compatibility diagnostics
- account-aware tab selection
- schedule binding to account context

### Controlled review workflow
- scan visible Facebook content
- create AI drafts
- edit/regenerate/reject/approve drafts
- preserve account/surface metadata on candidates
- locate the matching account context before composer preparation
- insert approved text
- user manually clicks **Gửi**

### AI Gateway
- local mock mode
- Cloudflare Worker bundle
- OpenAI-compatible / DeepSeek / Anthropic / Gemini adapters
- server-side provider API keys
- prompt versioning
- structured JSON validation
- usage/cost metadata

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

## Documentation

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/EXTENSION.md`
- `docs/AUTOMATION_MVP.md`
- `docs/AI_GATEWAY.md`
- `docs/QUEUE_SCHEDULER.md`
- `docs/PLATFORM_ADAPTERS.md`

The product keeps final social-platform submission under explicit user control.
