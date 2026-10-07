import { describe, expect, it } from 'vitest'
import { createMockDraft } from './mockAi'

describe('local mock AI', () => {
  it('creates a bounded structured draft without pretending personal experience', () => {
    const draft = createMockDraft({
      id: 'abcdef12',
      text: 'AI đang thay đổi cách chúng ta làm việc. Theo bạn kỹ năng nào quan trọng nhất?',
      sourceUrl: 'https://www.facebook.com/',
      capturedAt: 1,
    })
    expect(draft.text.length).toBeGreaterThan(30)
    expect(draft.text).not.toMatch(/tôi từng|mình từng|kinh nghiệm của tôi/i)
    expect(['INSIGHT', 'QUESTION', 'CLARIFICATION']).toContain(draft.strategy)
  })
})
