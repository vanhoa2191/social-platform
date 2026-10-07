import { getPromptTemplate } from '../ai/promptRegistry'
import type { AiGatewayRequest, AiGatewayResponse, PromptVersion } from '../ai/contracts'

interface Env {
  GATEWAY_TOKEN?: string
  AI_PROVIDER?: 'mock' | 'openai' | 'deepseek' | 'anthropic' | 'gemini'
  AI_MODEL?: string
  AI_API_KEY?: string
  AI_BASE_URL?: string
  AI_INPUT_USD_PER_M?: string
  AI_OUTPUT_USD_PER_M?: string
  RATE_LIMIT_PER_MINUTE?: string
  PROVIDER_TIMEOUT_MS?: string
  MAX_BODY_BYTES?: string
}

type DraftShape = {
  text: string
  strategy: 'INSIGHT' | 'QUESTION' | 'CLARIFICATION'
  confidence: number
}

const rateBuckets = new Map<string, { startedAt: number; count: number }>()

function numberSetting(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
  })
}

function requireAuth(request: Request, env: Env): Response | undefined {
  if (!env.GATEWAY_TOKEN) {
    if ((env.AI_PROVIDER || 'mock') !== 'mock') return json({ error: 'Gateway authentication is not configured' }, 503)
    return undefined
  }
  const expected = `Bearer ${env.GATEWAY_TOKEN}`
  if (request.headers.get('authorization') !== expected) return json({ error: 'Unauthorized' }, 401)
  return undefined
}

function rateLimit(request: Request, env: Env): Response | undefined {
  const max = numberSetting(env.RATE_LIMIT_PER_MINUTE, 30, 1, 300)
  const now = Date.now()
  const key = (request.headers.get('cf-connecting-ip') ?? 'unknown') + ':' + (request.headers.get('authorization') ?? 'anonymous')
  const bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.startedAt >= 60_000) { rateBuckets.set(key, { startedAt: now, count: 1 }); return undefined }
  if (bucket.count >= max) return json({ error: 'Rate limit exceeded' }, 429)
  bucket.count += 1
  return undefined
}

async function readJsonBody(request: Request, env: Env): Promise<unknown> {
  const maxBytes = numberSetting(env.MAX_BODY_BYTES, 16384, 1024, 65536)
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('Request body too large')
  return JSON.parse(text)
}

async function providerFetch(env: Env, input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), numberSetting(env.PROVIDER_TIMEOUT_MS, 25000, 3000, 45000))
  try { return await fetch(input, { ...init, signal: controller.signal }) }
  catch (error) { if (error instanceof Error && error.name === 'AbortError') throw new Error('AI provider timed out'); throw error }
  finally { globalThis.clearTimeout(timer) }
}

function extractJson(text: string): DraftShape {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Model did not return JSON')
  const value = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>
  const strategy = value.strategy
  if (strategy !== 'INSIGHT' && strategy !== 'QUESTION' && strategy !== 'CLARIFICATION') {
    throw new Error('Invalid strategy')
  }
  const confidence = Number(value.confidence)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Invalid confidence')
  if (typeof value.text !== 'string' || value.text.trim().length < 2 || value.text.trim().length > 1200) throw new Error('Invalid text')
  return { text: value.text.trim(), strategy, confidence }
}

function cost(env: Env, inputTokens: number, outputTokens: number): number {
  const inputRate = Number(env.AI_INPUT_USD_PER_M ?? 0)
  const outputRate = Number(env.AI_OUTPUT_USD_PER_M ?? 0)
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate
}

function postPrompt(request: AiGatewayRequest): string {
  return [
    'Bài viết:',
    request.post.text.slice(0, 5000),
    request.post.author ? `Tác giả: ${request.post.author}` : '',
    'Hãy tạo một bình luận phù hợp theo system prompt.',
  ].filter(Boolean).join('\n\n')
}

async function callOpenAiCompatible(env: Env, req: AiGatewayRequest, baseUrl: string, provider: string): Promise<AiGatewayResponse> {
  const model = env.AI_MODEL || 'default-model'
  if (!env.AI_API_KEY) throw new Error('AI_API_KEY is missing')
  const prompt = getPromptTemplate(req.promptVersion)
  const response = await providerFetch(env, `${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: postPrompt(req) },
      ],
      temperature: 0.6,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) throw new Error(`${provider} HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const data = await response.json() as any
  const draft = extractJson(data.choices?.[0]?.message?.content ?? '')
  const inputTokens = Number(data.usage?.prompt_tokens ?? 0)
  const outputTokens = Number(data.usage?.completion_tokens ?? 0)
  return {
    draft,
    provider,
    model,
    promptVersion: req.promptVersion,
    usage: { inputTokens, outputTokens, estimatedCostUsd: cost(env, inputTokens, outputTokens) },
  }
}

async function callAnthropic(env: Env, req: AiGatewayRequest): Promise<AiGatewayResponse> {
  const model = env.AI_MODEL || 'default-model'
  if (!env.AI_API_KEY) throw new Error('AI_API_KEY is missing')
  const prompt = getPromptTemplate(req.promptVersion)
  const response = await providerFetch(env, env.AI_BASE_URL || 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.AI_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      system: prompt.system,
      messages: [{ role: 'user', content: postPrompt(req) }],
    }),
  })
  if (!response.ok) throw new Error(`anthropic HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const data = await response.json() as any
  const draft = extractJson(data.content?.find((part: any) => part.type === 'text')?.text ?? '')
  const inputTokens = Number(data.usage?.input_tokens ?? 0)
  const outputTokens = Number(data.usage?.output_tokens ?? 0)
  return {
    draft,
    provider: 'anthropic',
    model,
    promptVersion: req.promptVersion,
    usage: { inputTokens, outputTokens, estimatedCostUsd: cost(env, inputTokens, outputTokens) },
  }
}

async function callGemini(env: Env, req: AiGatewayRequest): Promise<AiGatewayResponse> {
  const model = env.AI_MODEL || 'gemini-flash'
  if (!env.AI_API_KEY) throw new Error('AI_API_KEY is missing')
  const prompt = getPromptTemplate(req.promptVersion)
  const base = env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models'
  const response = await providerFetch(env, `${base.replace(/\/$/, '')}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.AI_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: postPrompt(req) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 300 },
    }),
  })
  if (!response.ok) throw new Error(`gemini HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const data = await response.json() as any
  const draft = extractJson(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
  const inputTokens = Number(data.usageMetadata?.promptTokenCount ?? 0)
  const outputTokens = Number(data.usageMetadata?.candidatesTokenCount ?? 0)
  return {
    draft,
    provider: 'gemini',
    model,
    promptVersion: req.promptVersion,
    usage: { inputTokens, outputTokens, estimatedCostUsd: cost(env, inputTokens, outputTokens) },
  }
}

async function generate(env: Env, req: AiGatewayRequest): Promise<AiGatewayResponse> {
  const provider = env.AI_PROVIDER || 'mock'
  if (provider === 'mock') {
    const question = /\?|theo bạn|quan điểm/i.test(req.post.text)
    return {
      draft: {
        text: question
          ? 'Điểm đáng chú ý là nên tách phần ra quyết định khỏi phần thực thi để hệ thống dễ kiểm soát và sửa lỗi hơn.'
          : 'Nếu triển khai ở quy mô nhỏ trước, bạn sẽ ưu tiên kiểm chứng chỉ số nào để biết workflow này thực sự hiệu quả?',
        strategy: question ? 'INSIGHT' : 'QUESTION',
        confidence: 0.82,
      },
      provider: 'mock',
      model: 'mock-v1',
      promptVersion: req.promptVersion,
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    }
  }
  if (provider === 'openai') {
    return callOpenAiCompatible(env, req, env.AI_BASE_URL || 'https://api.openai.com/v1', 'openai')
  }
  if (provider === 'deepseek') {
    return callOpenAiCompatible(env, req, env.AI_BASE_URL || 'https://api.deepseek.com', 'deepseek')
  }
  if (provider === 'anthropic') return callAnthropic(env, req)
  return callGemini(env, req)
}

function validateRequest(value: unknown): AiGatewayRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid request')
  const root = value as Record<string, any>
  const post = root.post
  const promptVersion = root.promptVersion as PromptVersion
  if (!post || typeof post.text !== 'string' || typeof post.id !== 'string') throw new Error('Invalid post')
  post.text = post.text.trim()
  if (post.text.length < 2 || post.text.length > 5000 || post.id.length > 200) throw new Error('Invalid post')
  if (typeof post.author === 'string') post.author = post.author.trim().slice(0, 200)
  delete post.sourceUrl
  delete post.permalink
  if (promptVersion !== 'comment-v1' && promptVersion !== 'comment-v2') throw new Error('Invalid promptVersion')
  return { post, promptVersion }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return json({ ok: true })
    const url = new URL(request.url)
    if (url.pathname === '/health' && request.method === 'GET') {
      const auth = requireAuth(request, env)
      if (auth) return auth
      return json({ ok: true, provider: env.AI_PROVIDER || 'mock', model: env.AI_MODEL || 'mock-v1', version: '0.3.0' })
    }
    if (url.pathname === '/v1/comment' && request.method === 'POST') {
      const auth = requireAuth(request, env)
      if (auth) return auth
      const limited = rateLimit(request, env)
      if (limited) return limited
      try {
        const body = validateRequest(await readJsonBody(request, env))
        return json(await generate(env, body))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gateway error'
        return json({ error: message }, message === 'Request body too large' ? 413 : message === 'AI provider timed out' ? 504 : 400)
      }
    }
    return json({ error: 'Not found' }, 404)
  },
}
