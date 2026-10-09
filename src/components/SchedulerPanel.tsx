import { useEffect, useMemo, useState } from 'react'
import type { ReviewSchedule, ReviewScheduleInput } from '../runtime/types'
import {
  deleteSchedule,
  isExtensionRuntime,
  listSchedules,
  runScheduleNow,
  saveSchedule,
} from '../extension/client'

const defaultForm: ReviewScheduleInput = {
  name: 'Quét Feed tạo nháp AI',
  enabled: true,
  intervalMinutes: 60,
  maxPosts: 10,
  startHour: 8,
  endHour: 22,
}

function formatDate(value?: number): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

export default function SchedulerPanel() {
  const extensionMode = isExtensionRuntime()
  const [items, setItems] = useState<ReviewSchedule[]>([])
  const [form, setForm] = useState<ReviewScheduleInput>(defaultForm)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const enabledCount = useMemo(() => items.filter((item) => item.enabled).length, [items])

  async function refresh() {
    if (!extensionMode) return
    const result = await listSchedules()
    if (result.ok) setItems(result.data)
    else setMessage(result.error)
  }

  useEffect(() => {
    if (!extensionMode) return
    let cancelled = false
    void listSchedules().then((result) => {
      if (cancelled) return
      if (result.ok) setItems(result.data)
      else setMessage(result.error)
    })
    return () => {
      cancelled = true
    }
  }, [extensionMode])

  async function submit() {
    setBusy('save')
    setMessage('')
    const result = await saveSchedule({ ...form, id: editingId })
    if (result.ok) {
      setForm(defaultForm)
      setEditingId(undefined)
      await refresh()
      setMessage('Đã lưu lịch chạy.')
    } else setMessage(result.error)
    setBusy(null)
  }

  function edit(item: ReviewSchedule) {
    setEditingId(item.id)
    setForm({
      id: item.id,
      name: item.name,
      enabled: item.enabled,
      intervalMinutes: item.intervalMinutes,
      maxPosts: item.maxPosts,
      startHour: item.startHour,
      endHour: item.endHour,
      accountBinding: item.accountBinding,
    })
  }

  async function remove(id: string) {
    const item = items.find((schedule) => schedule.id === id)
    if (!window.confirm('Xóa lịch "' + (item?.name ?? id) + '"? Nếu cloud có bản mới hơn, AutoTool sẽ yêu cầu xác nhận riêng trước khi xóa cloud.')) return
    setBusy(id + ':delete')
    const result = await deleteSchedule(id)
    if (result.ok) {
      await refresh()
      setMessage('Đã xóa lịch.')
    } else setMessage(result.error)
    setBusy(null)
  }

  async function runNow(id: string) {
    setBusy(id + ':run')
    const result = await runScheduleNow(id)
    if (result.ok) {
      setMessage('Đã đưa tác vụ vào queue và yêu cầu worker xử lý.')
      await refresh()
    } else setMessage(result.error)
    setBusy(null)
  }

  return (
    <div className="scheduler-real-layout">
      <section className="panel scheduler-editor">
        <div className="panel-head">
          <div>
            <h3>{editingId ? 'Sửa lịch' : 'Tạo lịch quét & tạo nháp'}</h3>
            <p>Khi lưu, lịch được bind tự động vào account context đang được xác minh trên Facebook.</p>
          </div>
          <span className="type-pill">{enabledCount} lịch đang bật</span>
        </div>

        <div className="scheduler-form-grid">
          <label>
            Tên lịch
            <input
              value={form.name}
              disabled={!extensionMode}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Chu kỳ
            <select
              value={form.intervalMinutes}
              disabled={!extensionMode}
              onChange={(event) => setForm({ ...form, intervalMinutes: Number(event.target.value) })}
            >
              <option value={15}>15 phút</option>
              <option value={30}>30 phút</option>
              <option value={60}>1 giờ</option>
              <option value={120}>2 giờ</option>
              <option value={240}>4 giờ</option>
              <option value={720}>12 giờ</option>
              <option value={1440}>24 giờ</option>
            </select>
          </label>
          <label>
            Bài tối đa/lần
            <input
              type="number"
              min={1}
              max={20}
              value={form.maxPosts}
              disabled={!extensionMode}
              onChange={(event) => setForm({ ...form, maxPosts: Number(event.target.value) })}
            />
          </label>
          <label>
            Trạng thái
            <select
              value={form.enabled ? 'on' : 'off'}
              disabled={!extensionMode}
              onChange={(event) => setForm({ ...form, enabled: event.target.value === 'on' })}
            >
              <option value="on">Đang bật</option>
              <option value="off">Tạm dừng</option>
            </select>
          </label>
          <label>
            Bắt đầu từ giờ
            <input
              type="number"
              min={0}
              max={23}
              value={form.startHour}
              disabled={!extensionMode}
              onChange={(event) => setForm({ ...form, startHour: Number(event.target.value) })}
            />
          </label>
          <label>
            Kết thúc trước giờ
            <input
              type="number"
              min={0}
              max={23}
              value={form.endHour}
              disabled={!extensionMode}
              onChange={(event) => setForm({ ...form, endHour: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="gateway-actions">
          {editingId && (
            <button
              className="secondary"
              onClick={() => {
                setEditingId(undefined)
                setForm(defaultForm)
              }}
            >
              Hủy sửa
            </button>
          )}
          <button className="primary" disabled={!extensionMode || busy === 'save'} onClick={() => void submit()}>
            {busy === 'save' ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : '＋ Tạo lịch'}
          </button>
        </div>

        {!extensionMode && <div className="runtime-note">Scheduler thật chỉ hoạt động khi load dưới dạng Chrome Extension.</div>}
        {message && <div className="runtime-message">{message}</div>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Lịch đã cấu hình</h3>
            <p>Worker dùng durable queue, lock và retry backoff.</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="review-empty">
            <strong>Chưa có lịch chạy</strong>
            <span>Tạo lịch đầu tiên ở khung bên trái.</span>
          </div>
        ) : (
          <div className="schedule-real-list">
            {items.map((item) => (
              <article key={item.id}>
                <div className="schedule-real-main">
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      mỗi {item.intervalMinutes} phút · tối đa {item.maxPosts} bài · {item.startHour}:00–{item.endHour}:00
                    </span>
                    <span className={item.accountBinding ? 'bound-account' : 'unbound-account'}>
                      {item.accountBinding ? '↳ ' + item.accountBinding.label : '! Lịch cũ chưa bind account context'}
                    </span>
                  </div>
                  <span className={item.enabled ? 'schedule-enabled' : 'schedule-disabled'}>
                    {item.enabled ? '● Đang bật' : 'Tạm dừng'}
                  </span>
                </div>
                <div className="schedule-real-meta">
                  <span>Lần gần nhất: <b>{formatDate(item.lastRunAt)}</b></span>
                  <span>Lần tiếp theo: <b>{formatDate(item.nextRunAt)}</b></span>
                </div>
                <div className="review-card-actions">
                  <button className="secondary" disabled={Boolean(busy)} onClick={() => edit(item)}>Sửa</button>
                  <button className="secondary" disabled={Boolean(busy)} onClick={() => void remove(item.id)}>Xóa</button>
                  <button className="primary" disabled={Boolean(busy) || !item.accountBinding} onClick={() => void runNow(item.id)}>
                    {busy === item.id + ':run' ? 'Đang chạy…' : '▶ Chạy ngay'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
