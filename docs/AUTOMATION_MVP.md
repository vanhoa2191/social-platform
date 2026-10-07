# Automation Engine MVP — v0.2.0

## Goal

Turn the read-only Facebook scanner into a controlled review workflow while keeping browser execution deterministic and human-approved.

## Implemented flow

1. Open Facebook in a normal Chrome tab.
2. Open the AutoTool dashboard.
3. Go to **Hàng đợi & Duyệt AI**.
4. Click **Quét & tạo nháp**.
5. The content script reads visible posts.
6. The local AI provider creates a structured comment draft for each candidate.
7. Each item enters **READY_FOR_REVIEW**.
8. The user explicitly chooses **Duyệt** or **Bỏ qua**.
9. Approved items can be **Điền vào Facebook**.
10. The content script finds the original post, opens the comment UI where possible and inserts the approved text.
11. The tool verifies the text is present and marks the candidate **PREPARED**.
12. The user reviews the actual Facebook composer and manually clicks **Gửi**.

The MVP intentionally does not auto-submit comments.

## Candidate state machine

```text
DRAFTING
   |
   v
READY_FOR_REVIEW ---> REJECTED
   |
   v
APPROVED -----------> REJECTED
   |
   v
PREPARING
   |
   +------> FAILED ---> READY_FOR_REVIEW
   |
   v
PREPARED
```

Invalid transitions are rejected by deterministic code.

## Safety controls

- Review-before-action is mandatory in this MVP.
- Emergency Stop prevents new automation actions.
- One preparation task is allowed at a time.
- Session action limit is enforced from extension settings.
- Failed DOM actions are categorized and returned to the UI.
- Duplicate post candidates use stable post fingerprints.
- The tool never asks the AI to decide selectors, clicks, retries or state transitions.
- The current executor only prepares an approved comment; it does not submit it.

## AI abstraction

The MVP uses `localMockAiProvider`.

It conforms to `AiDraftProvider`, so a future backend AI gateway can replace it without changing the browser execution state machine.

Current structured draft:

```ts
{
  text: string
  strategy: 'INSIGHT' | 'QUESTION' | 'CLARIFICATION'
  confidence: number
  provider: 'local-mock'
  generatedAt: number
}
```

## Local persistence

IndexedDB database: `autotool-runtime`

Stores:

- `jobs`
- `candidates`

Chrome storage:

- global runtime settings
- Emergency Stop state
- session action counter

## Error classes

Current error codes:

- `EMERGENCY_STOP`
- `WRONG_PAGE`
- `TAB_NOT_FOUND`
- `CONTENT_SCRIPT_UNAVAILABLE`
- `POST_NOT_FOUND`
- `COMPOSER_NOT_FOUND`
- `INVALID_STATE`
- `LOCKED`
- `UNKNOWN`

## Next step

Replace `localMockAiProvider` with an authenticated AI gateway and add prompt versioning, structured schema validation, cost tracking and a preview/edit workflow before approval.
