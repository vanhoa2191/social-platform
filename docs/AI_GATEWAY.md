# AI Gateway — v0.3.0

## Purpose

The extension no longer needs to store provider API keys. It can run in two modes:

- **Local mock** — zero external API calls; useful for UI/browser testing.
- **Gateway** — sends structured post data to a server-side AI gateway.

The browser runtime still controls state, review, limits and Facebook interaction. The AI layer only creates a draft.

## Architecture

```text
Chrome Extension
   |
   | post + promptVersion + gateway token
   v
AI Gateway
   |
   +-- prompt registry
   +-- provider adapter
   +-- schema validation
   +-- token/cost accounting
   |
   v
OpenAI / DeepSeek / Anthropic / Gemini
```

Provider API keys stay in gateway secrets.

## Endpoints

### GET /health

Returns:

```json
{
  "ok": true,
  "provider": "mock",
  "model": "mock-v1",
  "version": "0.3.0"
}
```

### POST /v1/comment

Request:

```json
{
  "post": {
    "id": "abc",
    "text": "Post content",
    "author": "Optional author",
    "sourceUrl": "https://www.facebook.com/"
  },
  "promptVersion": "comment-v2"
}
```

Response:

```json
{
  "draft": {
    "text": "Generated comment",
    "strategy": "INSIGHT",
    "confidence": 0.9
  },
  "provider": "openai",
  "model": "configured-model",
  "promptVersion": "comment-v2",
  "usage": {
    "inputTokens": 600,
    "outputTokens": 80,
    "estimatedCostUsd": 0.001
  }
}
```

## Cloudflare Worker build

```bash
npm run build:gateway
```

Output:

```text
dist-gateway/worker.js
```

Copy `wrangler.toml.example` to your own Wrangler config and set secrets outside Git:

```bash
wrangler secret put GATEWAY_TOKEN
wrangler secret put AI_API_KEY
```

Do not commit real secrets.

## Environment variables

- `AI_PROVIDER`: `mock | openai | deepseek | anthropic | gemini`
- `AI_MODEL`: provider model name
- `AI_BASE_URL`: optional provider endpoint override
- `AI_INPUT_USD_PER_M`: optional input-token price for cost estimates
- `AI_OUTPUT_USD_PER_M`: optional output-token price for cost estimates

Secrets:

- `GATEWAY_TOKEN`
- `AI_API_KEY`

## Extension configuration

Open **AI & Nội dung → AI Gateway**.

1. Select **AI Gateway**.
2. Enter the deployed gateway URL.
3. Choose a prompt version.
4. Enter the gateway token.
5. Save. Chrome asks for access only to that gateway origin.
6. Click **Kiểm tra kết nối**.

The gateway token is stored in `chrome.storage.session`, not persistent local storage.

## Review workflow

Drafts now show:

- provider
- model
- prompt version
- confidence
- input/output tokens
- estimated cost

Before approval, users can:

- edit the draft
- regenerate it
- reject it
- approve it

Approved text can be prepared in the Facebook composer, but v0.3.0 still requires the user to manually submit.
