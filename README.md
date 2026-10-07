# Social Platform / AutoTool v2

Campaign-centric UI and Chrome Extension MV3 runtime for a controlled social workflow system.

Current version: **0.2.0**

## Implemented

### Product UI
- dashboard
- campaign management and 5-step wizard
- accounts & profiles
- AI profiles and prompt UI
- content library
- scheduler
- queue
- audit logs
- analytics
- settings

### Chrome runtime
- Manifest V3
- background service worker
- Facebook content script
- typed runtime messaging
- IndexedDB queue and review candidates
- chrome.storage settings
- runtime status
- Emergency Stop
- session action limit

### Automation MVP
- scan visible Facebook posts
- create structured local AI drafts
- review / approve / reject / retry
- prepare an approved comment in the Facebook composer
- verify that the approved text was inserted
- user manually clicks **Gửi**

The MVP intentionally does **not** auto-submit comments.

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

Then:

1. open `chrome://extensions`
2. enable Developer mode
3. choose **Load unpacked**
4. select `dist/`
5. click the AutoTool toolbar icon
6. open Facebook in another tab
7. use **Browser Runtime** to test scanning
8. open **Hàng đợi & Duyệt AI**
9. choose **Quét & tạo nháp**
10. approve a draft and choose **Điền vào Facebook**
11. review it in Facebook and manually submit

## Documentation

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/EXTENSION.md`
- `docs/AUTOMATION_MVP.md`
