# Social Platform / AutoTool v2

Campaign-centric UI and Chrome Extension MV3 runtime for a social workflow control plane.

## Implemented

- Modern React + TypeScript dashboard
- Campaign management and 5-step creation wizard
- Accounts & profiles
- AI profiles and prompt UI
- Content library
- Scheduler, queue, audit logs and analytics
- Chrome Extension Manifest V3
- Background service worker
- Read-only Facebook feed scanner content script
- Typed runtime messaging
- IndexedDB local queue
- chrome.storage settings
- CI, lint, unit tests and verified production build

## Development

```bash
npm install
npm run dev
```

## Validate everything

```bash
npm run check
```

This runs lint, unit tests, the web build, extension runtime bundling and manifest verification.

## Test as a Chrome Extension

```bash
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

See:

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/EXTENSION.md`

The current browser scanner is intentionally read-only. Automated execution should remain deterministic and gated by review, limits, cooldowns and audit logging.
