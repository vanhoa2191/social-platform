import { useEffect, useMemo, useState } from 'react'
import { clearRuntimeEvents, isExtensionRuntime, listRuntimeEvents } from '../extension/client'
import type { RuntimeEvent, RuntimeEventLevel } from '../runtime/types'

function time(value: number): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value)
}

export default function RuntimeLogsPanel() {
  const extensionMode = isExtensionRuntime()
  const [items, setItems] = useState<RuntimeEvent[]>([])
  const [level, setLevel] = useState<'ALL' | RuntimeEventLevel>('ALL')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const visible = useMemo(
    () => level === 'ALL' ? items : items.filter((item) => item.level === level),
    [items, level],
  )

  async function refresh() {
    if (!extensionMode) return
    const result = await listRuntimeEvents(200)
    if (result.ok) setItems(result.data)
    else setMessage(result.error)
  }

  useEffect(() => {
    if (!extensionMode) return
    let cancelled = false
    void listRuntimeEvents(200).then((result) => {
      if (cancelled) return
      if (result.ok) setItems(result.data)
      else setMessage(result.error)
    })
    return () => {
      cancelled = true
    }
  }, [extensionMode])

  async function clear() {
    setBusy(true)
    const result = await clearRuntimeEvents()
    if (result.ok) {
      setItems([])
      setMessage('Đã xóa runtime log.')
    } else setMessage(result.error)
    setBusy(false)
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <div className="tabs">
          {(['ALL','INFO','WARN','ERROR'] as const).map((value) => (
            <button key={value} className={level === value ? 'active' : ''} onClick={() => setLevel(value)}>
              {value}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button className="secondary" disabled={!extensionMode} onClick={() => void refresh()}>↻ Làm mới</button>
          <button className="secondary" disabled={!extensionMode || busy} onClick={() => void clear()}>Xóa log</button>
        </div>
      </div>

      {!extensionMode && <div className="runtime-note">Runtime log chỉ có khi dashboard chạy trong Chrome Extension.</div>}
      {message && <div className="runtime-message">{message}</div>}

      <div className="runtime-log-list">
        {visible.length === 0 ? (
          <div className="review-empty"><strong>Chưa có event</strong><span>Scheduler, queue và review engine sẽ ghi event tại đây.</span></div>
        ) : visible.map((item) => (
          <div className="runtime-log-row" key={item.id}>
            <time>{time(item.createdAt)}</time>
            <span className={'log-level ' + item.level.toLowerCase()}>{item.level}</span>
            <span className="type-pill">{item.category}</span>
            <div>
              <strong>{item.message}</strong>
              {item.detail && <span>{item.detail}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
