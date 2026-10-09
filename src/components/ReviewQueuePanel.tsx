import { useEffect, useMemo, useState } from 'react'
import type { ReviewCandidate } from '../automation/model'
import {
  approveReviewCandidate,
  clearReviewCandidates,
  createReviewCandidates,
  getSafetyState,
  isExtensionRuntime,
  listReviewCandidates,
  prepareApprovedComment,
  regenerateReviewCandidate,
  rejectReviewCandidate,
  retryReviewCandidate,
  setEmergencyStop,
  updateReviewDraft,
} from '../extension/client'

const stateLabel: Record<ReviewCandidate['state'], string> = {
  DRAFTING: 'Đang tạo nháp',
  READY_FOR_REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PREPARING: 'Đang chuẩn bị',
  PREPARED: 'Đã điền',
  REJECTED: 'Đã bỏ qua',
  FAILED: 'Lỗi',
}

export default function ReviewQueuePanel() {
  const extensionMode = isExtensionRuntime()
  const [items, setItems] = useState<ReviewCandidate[]>([])
  const [emergencyStop, setEmergencyStopValue] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  const actionable = useMemo(
    () => items.filter((item) => !['REJECTED', 'PREPARED'].includes(item.state)),
    [items],
  )

  const totalEstimatedCost = useMemo(
    () => items.reduce((sum, item) => sum + (item.draft.usage?.estimatedCostUsd ?? 0), 0),
    [items],
  )

  async function refresh() {
    if (!extensionMode) return
    const [reviews, safety] = await Promise.all([listReviewCandidates(), getSafetyState()])
    if (reviews.ok) setItems(reviews.data)
    if (safety.ok) setEmergencyStopValue(safety.data.emergencyStop)
  }

  async function scanAndDraft() {
    setBusy('scan')
    setNotice('')
    const result = await createReviewCandidates(10)
    if (result.ok) {
      setItems(result.data)
      setNotice(`Đã tạo ${result.data.length} ứng viên để duyệt.`)
    } else {
      setNotice(result.error)
    }
    setBusy(null)
  }

  async function action(
    candidateId: string,
    kind: 'approve' | 'reject' | 'prepare' | 'retry' | 'regenerate',
  ) {
    setBusy(candidateId + kind)
    setNotice('')

    const result = kind === 'approve'
      ? await approveReviewCandidate(candidateId)
      : kind === 'reject'
        ? await rejectReviewCandidate(candidateId)
        : kind === 'retry'
          ? await retryReviewCandidate(candidateId)
          : kind === 'regenerate'
            ? await regenerateReviewCandidate(candidateId)
            : await prepareApprovedComment(candidateId)

    if (result.ok) {
      await refresh()
      if (kind === 'prepare') {
        setNotice('Đã điền comment vào Facebook. Hãy kiểm tra nội dung trên Facebook và tự bấm Gửi.')
      } else if (kind === 'regenerate') {
        setNotice('Đã tạo lại nháp AI.')
      }
    } else {
      setNotice(result.error)
      await refresh()
    }
    setBusy(null)
  }

  function startEditing(item: ReviewCandidate) {
    setEditingId(item.id)
    setEditingText(item.draft.text)
  }

  async function saveEditedDraft(candidateId: string) {
    setBusy(candidateId + 'edit')
    setNotice('')
    const result = await updateReviewDraft(candidateId, editingText)
    if (result.ok) {
      setEditingId(null)
      setEditingText('')
      await refresh()
      setNotice('Đã lưu nội dung nháp đã chỉnh sửa.')
    } else {
      setNotice(result.error)
    }
    setBusy(null)
  }

  async function toggleEmergencyStop() {
    setBusy('stop')
    const result = await setEmergencyStop(!emergencyStop)
    if (result.ok) {
      setEmergencyStopValue(result.data.emergencyStop)
      setNotice(
        result.data.emergencyStop
          ? 'Emergency Stop đã bật. Các job đang chờ được hủy; tác vụ mới sẽ bị chặn cho tới khi Stop được tắt.'
          : 'Emergency Stop đã tắt.',
      )
    } else {
      setNotice(result.error)
    }
    setBusy(null)
  }

  async function clearAll() {
    setBusy('clear')
    const result = await clearReviewCandidates()
    if (result.ok) {
      setItems([])
      setNotice('Đã xóa hàng đợi duyệt.')
    } else {
      setNotice(result.error)
    }
    setBusy(null)
  }

  useEffect(() => {
    if (!extensionMode) return
    let cancelled = false

    void Promise.all([listReviewCandidates(), getSafetyState()]).then(([reviews, safety]) => {
      if (cancelled) return
      if (reviews.ok) setItems(reviews.data)
      if (safety.ok) setEmergencyStopValue(safety.data.emergencyStop)
    })

    return () => {
      cancelled = true
    }
  }, [extensionMode])

  return (
    <section className="panel review-panel">
      <div className="panel-head">
        <div>
          <h3>AI Review Queue</h3>
          <p>Quét bài → tạo nháp → sửa/regenerate → duyệt → điền vào Facebook. Tool không tự bấm Gửi.</p>
        </div>
        <div className="review-actions">
          <button
            className={emergencyStop ? 'danger-btn active' : 'danger-btn'}
            disabled={!extensionMode || busy === 'stop'}
            onClick={() => void toggleEmergencyStop()}
          >
            {emergencyStop ? '■ Emergency Stop ON' : 'Emergency Stop'}
          </button>
          <button
            className="secondary"
            disabled={!extensionMode || busy === 'clear'}
            onClick={() => void clearAll()}
          >
            Xóa queue
          </button>
          <button
            className="primary"
            disabled={!extensionMode || emergencyStop || busy === 'scan'}
            onClick={() => void scanAndDraft()}
          >
            {busy === 'scan' ? 'Đang quét…' : '✦ Quét & tạo nháp'}
          </button>
        </div>
      </div>

      {!extensionMode && (
        <div className="review-empty">
          <strong>Web preview đang bật</strong>
          <span>Load thư mục dist dưới dạng Chrome Extension để sử dụng Review Queue thật.</span>
        </div>
      )}

      {extensionMode && items.length === 0 && (
        <div className="review-empty">
          <strong>Chưa có bài nào chờ duyệt</strong>
          <span>Mở Facebook ở tab khác rồi chọn “Quét & tạo nháp”.</span>
        </div>
      )}

      {notice && <div className="review-notice">{notice}</div>}

      {items.length > 0 && (
        <>
          <div className="review-summary">
            <span><strong>{items.length}</strong> tổng ứng viên</span>
            <span><strong>{actionable.length}</strong> cần xử lý</span>
            <span><strong>{items.filter((item) => item.state === 'PREPARED').length}</strong> đã điền</span>
            <span><strong>${totalEstimatedCost.toFixed(4)}</strong> AI cost ước tính</span>
          </div>

          <div className="review-list">
            {items.map((item) => (
              <article className={'review-card state-' + item.state.toLowerCase()} key={item.id}>
                <div className="review-source">
                  <div>
                    <strong>{item.post.author || 'Bài viết Facebook'}</strong>
                    <span>
                      {item.post.accountLabel ? item.post.accountLabel + ' · ' : ''}
                      {item.post.surface ? item.post.surface + ' · ' : ''}
                      {item.post.permalink ? 'Có permalink' : item.post.id}
                    </span>
                  </div>
                  <span className={'review-state ' + item.state.toLowerCase()}>{stateLabel[item.state]}</span>
                </div>

                <p className="review-post">
                  {item.post.text.slice(0, 360)}
                  {item.post.text.length > 360 ? '…' : ''}
                </p>

                <div className="review-draft">
                  <div>
                    <b>✦ Nháp AI · {item.draft.strategy}{item.draft.edited ? ' · đã sửa' : ''}</b>
                    <span>
                      {Math.round(item.draft.confidence * 100)}% · {item.draft.provider}
                      {item.draft.model ? ` / ${item.draft.model}` : ''}
                      {item.draft.promptVersion ? ` · ${item.draft.promptVersion}` : ''}
                    </span>
                  </div>

                  {editingId === item.id ? (
                    <textarea
                      className="review-editor"
                      value={editingText}
                      maxLength={1200}
                      onChange={(event) => setEditingText(event.target.value)}
                    />
                  ) : (
                    <p>{item.draft.text}</p>
                  )}

                  {item.draft.usage && (
                    <div className="usage-line">
                      <span>
                        {item.draft.usage.inputTokens} input · {item.draft.usage.outputTokens} output tokens
                      </span>
                      <strong>${item.draft.usage.estimatedCostUsd.toFixed(6)}</strong>
                    </div>
                  )}
                </div>

                {item.error && <div className="review-error">{item.error}</div>}

                <div className="review-card-actions">
                  {item.state === 'READY_FOR_REVIEW' && (
                    <>
                      {editingId === item.id ? (
                        <>
                          <button
                            className="secondary"
                            disabled={Boolean(busy)}
                            onClick={() => {
                              setEditingId(null)
                              setEditingText('')
                            }}
                          >
                            Hủy sửa
                          </button>
                          <button
                            className="primary"
                            disabled={Boolean(busy) || editingText.trim().length < 2}
                            onClick={() => void saveEditedDraft(item.id)}
                          >
                            Lưu nháp
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="secondary"
                            disabled={Boolean(busy) || emergencyStop}
                            onClick={() => void action(item.id, 'regenerate')}
                          >
                            ↻ Tạo lại
                          </button>
                          <button
                            className="secondary"
                            disabled={Boolean(busy)}
                            onClick={() => startEditing(item)}
                          >
                            Sửa
                          </button>
                          <button
                            className="secondary"
                            disabled={Boolean(busy)}
                            onClick={() => void action(item.id, 'reject')}
                          >
                            Bỏ qua
                          </button>
                          <button
                            className="primary"
                            disabled={Boolean(busy) || emergencyStop}
                            onClick={() => void action(item.id, 'approve')}
                          >
                            ✓ Duyệt
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {item.state === 'APPROVED' && (
                    <>
                      <button
                        className="secondary"
                        disabled={Boolean(busy)}
                        onClick={() => void action(item.id, 'reject')}
                      >
                        Hủy duyệt
                      </button>
                      <button
                        className="primary"
                        disabled={Boolean(busy) || emergencyStop}
                        onClick={() => void action(item.id, 'prepare')}
                      >
                        Điền vào Facebook
                      </button>
                    </>
                  )}

                  {item.state === 'PREPARED' && (
                    <span className="prepared-hint">
                      ✓ Đã điền. Kiểm tra trên Facebook và tự bấm Gửi.
                    </span>
                  )}

                  {item.state === 'FAILED' && (
                    <>
                      <span className="failed-hint">
                        Tác vụ lỗi. Có thể đưa lại về hàng đợi duyệt để thử lại.
                      </span>
                      <button
                        className="secondary"
                        disabled={Boolean(busy)}
                        onClick={() => void action(item.id, 'retry')}
                      >
                        Thử lại
                      </button>
                    </>
                  )}

                  {item.state === 'REJECTED' && <span className="muted-hint">Đã bỏ qua.</span>}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
