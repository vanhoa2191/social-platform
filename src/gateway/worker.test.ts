import { describe, expect, it } from 'vitest'
import worker, { UserRateLimiter } from './worker'

describe('AI gateway worker', () => {
  it('reports health in mock mode', async () => {
    const response = await worker.fetch(new Request('https://gateway.test/health'), { AI_PROVIDER: 'mock' })
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.provider).toBe('mock')
  })

  it('returns a structured mock comment', async () => {
    const response = await worker.fetch(new Request('https://gateway.test/v1/comment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        post: {
          id: 'abc',
          text: 'AI automation nên tách reasoning và browser execution. Theo bạn đâu là điểm khó nhất?',
          sourceUrl: 'https://www.facebook.com/',
        },
        promptVersion: 'comment-v2',
      }),
    }), { AI_PROVIDER: 'mock' })

    expect(response.status).toBe(200)
    const body = await response.json() as any
    expect(body.draft.text.length).toBeGreaterThan(20)
    expect(['INSIGHT', 'QUESTION', 'CLARIFICATION']).toContain(body.draft.strategy)
    expect(body.promptVersion).toBe('comment-v2')
  })

  it('enforces gateway token when configured', async () => {
    const response = await worker.fetch(new Request('https://gateway.test/health'), {
      AI_PROVIDER: 'mock',
      GATEWAY_TOKEN: 'secret',
    })
    expect(response.status).toBe(401)
  })

  it('requires gateway authentication for real providers', async () => {
    const response = await worker.fetch(new Request('https://gateway.test/health'), {
      AI_PROVIDER: 'openai',
    })
    expect(response.status).toBe(503)
  })

  it('rejects oversized request bodies', async () => {
    const response = await worker.fetch(new Request('https://gateway.test/v1/comment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        post: { id: 'large', text: 'x'.repeat(5000) },
        promptVersion: 'comment-v2',
      }),
    }), { AI_PROVIDER: 'mock', MAX_BODY_BYTES: '1024' })

    expect(response.status).toBe(413)
  })

  it('rate limits repeated generation requests', async () => {
    const makeRequest = () => new Request('https://gateway.test/v1/comment', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer rate-test',
      },
      body: JSON.stringify({
        post: { id: 'rate', text: 'Một bài viết đủ dài để kiểm tra rate limit.' },
        promptVersion: 'comment-v2',
      }),
    })
    const env = {
      AI_PROVIDER: 'mock' as const,
      GATEWAY_TOKEN: 'rate-test',
      RATE_LIMIT_PER_MINUTE: '1',
    }
    expect((await worker.fetch(makeRequest(), env)).status).toBe(200)
    expect((await worker.fetch(makeRequest(), env)).status).toBe(429)
  })

  it('rejects absent or invalid Firebase tokens', async () => {
    const env = { AI_PROVIDER: 'mock' as const, GATEWAY_AUTH_MODE: 'firebase' as const, FIREBASE_PROJECT_ID: 'demo-autotool' }
    const missing = await worker.fetch(new Request('https://gateway.test/health'), env)
    expect(missing.status).toBe(401)
    const invalid = await worker.fetch(new Request('https://gateway.test/health', {
      headers: { authorization: 'Bearer not-a-jwt' },
    }), env)
    expect(invalid.status).toBe(401)
  })

  it('restricts CORS origins', async () => {
    const env = { AI_PROVIDER: 'mock' as const, ALLOWED_ORIGINS: 'https://dashboard.example' }
    const bad = await worker.fetch(new Request('https://gateway.test/v1/comment', { method: 'OPTIONS', headers: { origin: 'https://other.example' } }), env)
    expect(bad.status).toBe(403)
    expect(bad.headers.get('access-control-allow-origin')).toBeNull()
    const good = await worker.fetch(new Request('https://gateway.test/v1/comment', { method: 'OPTIONS', headers: { origin: 'https://dashboard.example' } }), env)
    expect(good.status).toBe(204)
    expect(good.headers.get('access-control-allow-origin')).toBe('https://dashboard.example')
  })

  it('rejects actual cross-origin POST requests, not only preflight', async () => {
    const response = await worker.fetch(new Request('https://gateway.test/v1/comment', {
      method: 'POST',
      headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' },
      body: '{}',
    }), { AI_PROVIDER: 'mock', ALLOWED_ORIGINS: 'chrome-extension://trusted-extension-id' })
    expect(response.status).toBe(403)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('requires a durable quota for paid AI providers, even with a valid shared dev token', async () => {
    const response = await worker.fetch(new Request('https://gateway.test/v1/comment', {
      method: 'POST',
      headers: { authorization: 'Bearer shared-dev-token', 'content-type': 'application/json' },
      body: JSON.stringify({ post: { id: '123', text: 'Review an example post.' }, promptVersion: 'comment-v2' }),
    }), { AI_PROVIDER: 'openai', GATEWAY_TOKEN: 'shared-dev-token' })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: 'Production quota binding missing' })
  })

  it('enforces the durable quota before attempting paid provider calls', async () => {
    const response = await worker.fetch(new Request('https://gateway.test/v1/comment', {
      method: 'POST',
      headers: { authorization: 'Bearer shared-dev-token', 'content-type': 'application/json' },
      body: JSON.stringify({ post: { id: '123', text: 'Review an example post.' }, promptVersion: 'comment-v2' }),
    }), {
      AI_PROVIDER: 'openai',
      GATEWAY_TOKEN: 'shared-dev-token',
      RATE_LIMITER: {
        idFromName: (key: string) => key,
        get: () => ({ fetch: async () => new Response(null, { status: 429 }) }),
      },
    })
    expect(response.status).toBe(429)
  })

  it('increments a Durable Object quota atomically and refuses excess requests', async () => {
    const values = new Map<string, unknown>()
    const instance = new UserRateLimiter({
      storage: {
        transaction: async <T>(callback: (tx: {
          get<TValue>(key: string): Promise<TValue | undefined>;
          put(key: string, value: unknown): Promise<void>;
        }) => Promise<T>) => callback({
          get: async <TValue>(key: string) => values.get(key) as TValue | undefined,
          put: async (key: string, value: unknown) => { values.set(key, value) },
        }),
      },
    })
    const consume = () => instance.fetch(new Request('https://rate-limit.internal/consume', {
      method: 'POST',
      body: JSON.stringify({ limit: 2 }),
    }))
    expect((await consume()).status).toBe(204)
    expect((await consume()).status).toBe(204)
    expect((await consume()).status).toBe(429)
    const invalid = await instance.fetch(new Request('https://rate-limit.internal/consume', {
      method: 'POST', body: JSON.stringify({ limit: -1 }),
    }))
    expect(invalid.status).toBe(400)
  })

})
