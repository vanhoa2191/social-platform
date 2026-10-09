# AI Gateway — v0.14 beta

The browser sends only minimum required post metadata to a server-side Cloudflare Worker. AI drafts **never** trigger final Facebook Submit; review and final click are manual.

## Authentication and quota

The default staging/production authentication is a **Firebase ID token**: the Worker verifies Google's RS256 JWKS, Firebase project issuer and audience, user subject and auth_time. Shared gateway token mode is a dev compatibility fallback, not recommended for production. The Chrome Extension uses `firebase/auth/web-extension`.

Paid providers (`openai`, `deepseek`, `anthropic`, `gemini`) **fail closed** unless a Cloudflare `RATE_LIMITER` Durable Object namespace is bound. The Durable Object uses atomic storage transactions and separate objects by authenticated Firebase UID, with a fixed one-minute request quota. `mock` uses only a lightweight local fallback for tests. This is a request quota, not a guaranteed token/cost budget.

The `ALLOWED_ORIGINS` comma-separated allowlist should include the exact `chrome-extension://<installed-id>` origin. Cross-origin POST and OPTIONS with an unapproved Origin receive HTTP 403. Worker-to-Worker/no-Origin calls still require authenticated tokens.

## Worker endpoints

- `GET /health` requires valid authentication; returns provider, model, version.
- `POST /v1/comment` requires authentication, quota and validated JSON with `{post:{id,text,author?},promptVersion:'comment-v2'|'comment-v1'}`. The Worker strips arbitrary post fields and doesn't expose provider errors/raw upstream responses.

AI provider API keys remain in Cloudflare secrets. Configure `GATEWAY_AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS`, `AI_PROVIDER`, `AI_MODEL`, `RATE_LIMIT_PER_MINUTE` and the `RATE_LIMITER` Durable Object migration in the private Wrangler config. A Cloudflare account with Workers/Durable Objects support and owner approval is required for deployment.

```bash
npm run build:gateway
cp wrangler.toml.example wrangler.staging.toml
node scripts/preflight-staging.mjs .env.staging.local wrangler.staging.toml
npx wrangler@4 deploy --dry-run --config wrangler.staging.toml
```

**Do not deploy yet:** run the [full staging runbook](STAGING_RUNBOOK.md), including real Firebase token verification and manual Facebook pilot. Google-hosted JWKS verification does not accept Firebase Emulator's unsigned tokens.

## v0.14 production controls

Firebase bearer tokens are sent only to the exact `VITE_AI_GATEWAY_ORIGIN` compiled into the extension. Paid providers require the Durable Object binding, a positive `GLOBAL_REQUEST_LIMIT_PER_DAY`, and should use `ALLOWED_FIREBASE_UIDS` during controlled pilots. Registration is disabled by default in controlled builds.
