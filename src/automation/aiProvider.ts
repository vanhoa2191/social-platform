import type { FeedPost } from '../extension/types'
import type { CommentDraft } from './model'
import { createMockDraft } from './mockAi'

export interface AiDraftProvider {
  readonly id: string
  generateComment(post: FeedPost): Promise<CommentDraft>
}

export const localMockAiProvider: AiDraftProvider = {
  id: 'local-mock',
  async generateComment(post) {
    return createMockDraft(post)
  },
}
