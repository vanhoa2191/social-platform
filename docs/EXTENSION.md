# Chrome Extension MV3 runtime

## What is implemented

The project now builds both the React dashboard and a Chrome Extension Manifest V3 runtime.

Runtime pieces:

- `public/manifest.json`
- `src/extension/background.ts` — service worker, active-tab bridge, queue scheduler
- `src/extension/content.ts` — read-only Facebook page scanner
- `src/extension/queue.ts` — local IndexedDB queue with de-duplication
- `src/extension/storage.ts` — extension settings in chrome.storage
- `src/extension/client.ts` — dashboard-to-runtime bridge
- `src/components/RuntimeCard.tsx` — live runtime status and scan-test UI

The current content script only reads visible post text and metadata. It does not automatically submit comments or reactions.

## Build

```bash
npm ci
npm run check
```

The extension-ready output is created in `dist/`.

Required files are verified automatically:

- `dist/manifest.json`
- `dist/index.html`
- `dist/background.js`
- `dist/content.js`

## Load unpacked in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the generated `dist` folder.
6. Pin AutoTool if desired.
7. Click the AutoTool toolbar button to open the dashboard.
8. Open Facebook in another tab.
9. From the dashboard, use **Quét thử tab Facebook**.

## Runtime message contract

Dashboard → background:

- `PING`
- `GET_RUNTIME_STATUS`
- `SCAN_ACTIVE_TAB`
- `QUEUE_LIST`
- `QUEUE_ENQUEUE`
- `QUEUE_CLEAR`

Background → content script:

- `CONTENT_PING`
- `GET_PAGE_CONTEXT`
- `SCAN_FEED`

## Safety model

Browser execution is deterministic code. AI is not allowed to freely click or navigate the browser.

The next execution phase should preserve:

- review-before-action by default
- action limits
- cooldowns
- duplicate prevention
- retry ceilings
- audit logs
- emergency stop
