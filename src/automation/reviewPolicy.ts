import type { CommentDraft, ReviewCandidate } from './model'

export function shouldGenerateForScannedPost(existing?: ReviewCandidate): boolean {
  return !existing
}

export function approvalSnapshot(
  draft: CommentDraft,
  approvedAt = Date.now(),
): Pick<ReviewCandidate, 'approvedDraft' | 'approvedAt'> {
  return {
    approvedDraft: {
      ...draft,
      usage: draft.usage ? { ...draft.usage } : undefined,
    },
    approvedAt,
  }
}
