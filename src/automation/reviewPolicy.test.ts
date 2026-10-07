import { describe, expect, it } from 'vitest'
import type { ReviewCandidate } from './model'
import { approvalSnapshot, shouldGenerateForScannedPost } from './reviewPolicy'

function candidate(state: ReviewCandidate['state']): ReviewCandidate {
  return {
    id: 'review-1',
    post: {
      id: 'post-1',
      text: 'A sufficiently long post for the candidate fixture.',
      sourceUrl: 'https://www.facebook.com/',
      capturedAt: 1,
    },
    draft: {
      text: 'Human-visible draft A',
      strategy: 'INSIGHT',
      confidence: 0.9,
      provider: 'test',
      usage: { inputTokens: 1, outputTokens: 2, estimatedCostUsd: 0 },
      generatedAt: 1,
    },
    state,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('review integrity policy', () => {
  it.each(['READY_FOR_REVIEW','APPROVED','PREPARING','PREPARED','REJECTED','FAILED'] as const)(
    'never auto-regenerates an existing %s candidate during a scan',
    (state) => expect(shouldGenerateForScannedPost(candidate(state))).toBe(false),
  )

  it('captures an approval snapshot separate from the editable draft object', () => {
    const item = candidate('READY_FOR_REVIEW')
    const snapshot = approvalSnapshot(item.draft, 123)
    item.draft.text = 'Draft changed after approval'
    item.draft.usage!.inputTokens = 999
    expect(snapshot.approvedAt).toBe(123)
    expect(snapshot.approvedDraft?.text).toBe('Human-visible draft A')
    expect(snapshot.approvedDraft?.usage?.inputTokens).toBe(1)
  })
})
