import { useEffect, useState } from 'react'
import { isExtensionRuntime, listReviewCandidates, listRuntimeEvents, listSchedules } from '../extension/client'
import type { ReviewCandidate } from '../automation/model'
import type { RuntimeEvent, ReviewSchedule } from '../runtime/types'

export default function AnalyticsPanel() {
  const [reviews, setReviews] = useState<ReviewCandidate[]>([])
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [schedules, setSchedules] = useState<ReviewSchedule[]>([])
  const [message, setMessage] = useState('')
  async function reload() {
    const [a,b,c] = await Promise.all([listReviewCandidates(), listRuntimeEvents(500), listSchedules()])
    if (a.ok) setReviews(a.data)
    if (b.ok) setEvents(b.data)
    if (c.ok) setSchedules(c.data)
    const failed = [a,b,c].filter(result => !result.ok)
    setMessage(failed.length ? 'Một phần dữ liệu runtime chưa tải được.' : '')
  }
  useEffect(() => {
    if (!isExtensionRuntime()) return
    const id = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(id)
  }, [])
  const counts = {
    drafts: reviews.filter(x => x.state === 'READY_FOR_REVIEW').length,
    prepared: reviews.filter(x => x.state === 'PREPARED').length,
    errors: events.filter(x => x.level === 'ERROR').length,
    enabled: schedules.filter(x => x.enabled).length,
  }
  return <section className="panel">
    <div className="panel-head"><div><h3>Runtime Analytics</h3><p>Dữ liệu thật từ hàng chờ và 500 sự kiện gần nhất, không phải kết quả tương tác Facebook.</p></div>
      <button className="secondary" onClick={() => void reload()} disabled={!isExtensionRuntime()}>Làm mới</button></div>
    <div className="context-policy-grid">
      <div><strong>Nháp chờ duyệt</strong><span>{counts.drafts}</span></div>
      <div><strong>Đã chuẩn bị</strong><span>{counts.prepared}</span></div>
      <div><strong>Runtime errors</strong><span>{counts.errors}</span></div>
      <div><strong>Lịch đang bật</strong><span>{counts.enabled}</span></div>
    </div>
    {!isExtensionRuntime() && <p>Chỉ có dữ liệu thật khi mở dashboard trong Chrome Extension.</p>}
    {message && <div className="runtime-message">{message}</div>}
  </section>
}
