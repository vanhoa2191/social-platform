import { normalizeText } from '../core/helpers'
import type { FeedPost } from '../extension/types'
import type { CommentDraft } from './model'

const questions = [
  'Theo bạn, yếu tố nào sẽ quyết định hiệu quả nhất khi áp dụng cách này trong thực tế?',
  'Nếu triển khai ở quy mô nhỏ trước, bạn sẽ ưu tiên kiểm chứng chỉ số nào?',
  'Điểm nào trong quy trình này theo bạn dễ trở thành nút thắt nhất?',
]

const insights = [
  'Điểm đáng chú ý là khi tách phần ra quyết định khỏi phần thực thi, hệ thống sẽ dễ kiểm soát và sửa lỗi hơn.',
  'Cách tiếp cận này sẽ bền hơn nếu mỗi bước đều có tiêu chí thành công rõ ràng và log để kiểm tra lại.',
  'Giá trị lớn nhất có lẽ nằm ở việc chuẩn hóa workflow trước, rồi mới dùng AI ở những bước thực sự cần hiểu ngữ cảnh.',
]

export function createMockDraft(post: FeedPost): CommentDraft {
  const text = normalizeText(post.text).toLowerCase()
  const useQuestion = /\?|theo bạn|ý kiến|quan điểm|làm sao|như thế nào/.test(text)
  const source = useQuestion ? insights : questions
  const selector = Number.parseInt(post.id.slice(-2), 16)
  const phrase = source[Number.isNaN(selector) ? 0 : selector % source.length]

  return {
    text: phrase,
    strategy: useQuestion ? 'INSIGHT' : 'QUESTION',
    confidence: 0.82,
    provider: 'local-mock',
    model: 'mock-v1',
    promptVersion: 'comment-v2',
    usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    generatedAt: Date.now(),
  }
}
