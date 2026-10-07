# Implementation status

## Completed

### Phase 1 — UI shell
- Dashboard
- Campaign list
- 5-step campaign wizard
- Accounts & profiles
- AI profiles
- Content library
- Scheduler
- Queue
- Logs
- Analytics
- Settings

### Phase 2 — Chrome Extension MV3 core
- Manifest V3
- Background service worker
- Facebook content script
- Typed message contracts
- chrome.storage settings
- IndexedDB local queue
- de-duplication key support
- one-minute queue alarm
- extension dashboard bridge
- active-tab runtime status
- read-only feed scan test
- CI workflow
- unit tests
- build verification

## Next

### Phase 3 — Automation engine MVP
1. Define deterministic campaign/job state machine.
2. Convert scanned posts into review candidates.
3. Add AI-draft adapter interface with a local mock provider first.
4. Add review queue UI.
5. Add explicit user-approved action executor.
6. Verify action result before marking success.
7. Add error taxonomy and retry policy.
8. Add emergency stop and account-level locks.
