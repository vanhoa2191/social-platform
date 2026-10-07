import { useEffect, useState } from 'react'
import { getRuntimeStatus, isExtensionRuntime, scanActiveFacebookTab } from '../extension/client'
import type { FeedPost, RuntimeStatus } from '../extension/types'

export default function RuntimeCard() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const extensionMode = isExtensionRuntime()

  async function refresh() {
    if (!extensionMode) return
    const result = await getRuntimeStatus()
    if (result.ok) {
      setStatus(result.data)
      setMessage('')
    } else {
      setMessage(result.error)
    }
  }

  async function scan() {
    setLoading(true)
    setMessage('')
    const result = await scanActiveFacebookTab(10)
    if (result.ok) {
      setPosts(result.data)
      setMessage(result.data.length ? `Đã đọc ${result.data.length} bài đang hiển thị.` : 'Không tìm thấy bài phù hợp trong vùng đang hiển thị.')
    } else {
      setMessage(result.error)
    }
    setLoading(false)
    await refresh()
  }

  useEffect(() => {
    if (!extensionMode) return
    let cancelled = false

    void getRuntimeStatus().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setStatus(result.data)
        setMessage('')
      } else {
        setMessage(result.error)
      }
    })

    return () => {
      cancelled = true
    }
  }, [extensionMode])

  return (
    <section className="panel runtime-panel">
      <div className="panel-head">
        <div>
          <h3>Browser Runtime</h3>
          <p>Kiểm tra Chrome Extension, queue, scheduler và tab Facebook hiện tại.</p>
        </div>
        <span className={extensionMode ? 'runtime-badge online' : 'runtime-badge preview'}>
          {extensionMode
            ? status?.safety.emergencyStop
              ? '■ Emergency Stop'
              : '● Extension đang chạy'
            : '● Web preview'}
        </span>
      </div>

      <div className="runtime-grid">
        <div className="runtime-stat">
          <span>Phiên bản / channel</span>
          <strong>
            {status ? `v${status.version} · ${status.releaseChannel}` : (extensionMode ? 'Đang kết nối…' : 'preview')}
          </strong>
        </div>
        <div className="runtime-stat">
          <span>Tab hiện tại</span>
          <strong>{status?.activeTab?.title ?? (extensionMode ? 'Chưa xác định' : 'Chỉ khả dụng khi load extension')}</strong>
        </div>
        <div className="runtime-stat">
          <span>Account context</span>
          <strong className={status?.platformContext?.account?.verified ? 'ok-text' : ''}>
            {status?.platformContext?.account?.label ?? 'Chưa nhận diện'}
          </strong>
        </div>
        <div className="runtime-stat">
          <span>Surface / Adapter</span>
          <strong>
            {status ? (status.platformContext?.surface ?? 'UNKNOWN') + ' · ' + (status.adapterDiagnostic?.health ?? '—') : '—'}
          </strong>
        </div>
        <div className="runtime-stat">
          <span>Queue / Review</span>
          <strong>{status?.queuedJobs ?? 0} job · {status?.reviewCandidates ?? 0} review</strong>
        </div>
        <div className="runtime-stat">
          <span>Lịch / lỗi gần đây</span>
          <strong>{status ? `${status.enabledSchedules} lịch · ${status.recentErrors} lỗi` : '—'}</strong>
        </div>
        <div className="runtime-stat">
          <span>Runtime DB / Pilot</span>
          <strong>
            {status ? `DB v${status.runtimeDbVersion} · ${status.pilot.enabled ? 'Pilot ON' : 'Pilot OFF'}` : '—'}
          </strong>
        </div>
        <div className="runtime-stat">
          <span>Giới hạn phiên</span>
          <strong>{status ? `${status.sessionActions} / ${status.maxSessionActions}` : '—'}</strong>
        </div>
        <button className="primary runtime-action" disabled={!extensionMode || loading} onClick={() => void scan()}>
          {loading ? 'Đang quét…' : 'Quét thử tab Facebook'}
        </button>
      </div>

      {!extensionMode && (
        <div className="runtime-note">
          Bản web dùng để phát triển UI. Sau khi chạy <code>npm run build</code>, load thư mục <code>dist</code> tại chrome://extensions để kiểm thử runtime thật.
        </div>
      )}
      {message && <div className="runtime-message">{message}</div>}
      {posts.length > 0 && (
        <div className="scan-preview">
          {posts.slice(0, 3).map((post) => (
            <article key={post.id}>
              <div><strong>{post.author || 'Bài viết'}</strong><span>{post.id}</span></div>
              <p>{post.text.slice(0, 220)}{post.text.length > 220 ? '…' : ''}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
