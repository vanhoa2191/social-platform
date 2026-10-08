import { useEffect, useState } from 'react'
import { deleteRemoteContentItem, listRemoteContentItems, upsertRemoteContentItem, type ContentItemRecord } from '../backend/repository'

export default function ContentLibraryPanel() {
  const [items, setItems] = useState<ContentItemRecord[]>([])
  const [editing, setEditing] = useState<ContentItemRecord | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<ContentItemRecord['kind']>('template')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function reload() {
    try { setItems(await listRemoteContentItems()) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không tải được nội dung Firebase.') }
  }
  useEffect(() => {
    const id = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(id)
  }, [])

  function reset() {
    setEditing(null); setTitle(''); setBody(''); setKind('template')
  }

  async function save() {
    if (!title.trim()) return
    setBusy(true)
    try {
      await upsertRemoteContentItem({
        id: editing?.id, revision: editing?.revision,
        title, body, kind, tags: [],
      })
      reset()
      await reload()
      setMessage('Đã lưu nội dung lên Firebase.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không lưu được.') }
    finally { setBusy(false) }
  }

  async function remove(id?: string) {
    if (!id) return
    setBusy(true)
    try {
      await deleteRemoteContentItem(id)
      await reload()
      if (editing?.id === id) reset()
      setMessage('Đã xóa nội dung.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể xóa.') }
    finally { setBusy(false) }
  }

  return <section className="panel">
    <div className="panel-head"><div><h3>Kho nội dung Firebase</h3><p>Lưu prompt, template, note thật. Không tự đăng nội dung.</p></div>
      <button className="secondary" onClick={() => void reload()}>Làm mới</button></div>
    <div className="gateway-form">
      <label>Tiêu đề<input maxLength={200} value={title} onChange={e => setTitle(e.target.value)}/></label>
      <label>Loại<select value={kind} onChange={e => setKind(e.target.value as ContentItemRecord['kind'])}>
        <option value="prompt">Prompt</option><option value="template">Template</option><option value="note">Note</option>
      </select></label>
    </div>
    <label>Nội dung<textarea className="prompt-box" maxLength={10000} value={body} onChange={e => setBody(e.target.value)}/></label>
    <div className="gateway-actions">
      <button className="primary" disabled={busy || !title.trim()} onClick={() => void save()}>{editing ? 'Lưu thay đổi' : 'Tạo nội dung'}</button>
      {editing && <button className="secondary" onClick={reset}>Hủy sửa</button>}
    </div>
    <div className="crud-list">{items.map(item => <article className="crud-item" key={item.id}>
      <div><strong>{item.title}</strong><p>{item.kind} · {item.body.slice(0, 160)}</p></div>
      <div className="gateway-actions">
        <button className="secondary" onClick={() => { setEditing(item); setTitle(item.title); setBody(item.body); setKind(item.kind) }}>Sửa</button>
        <button className="secondary" disabled={busy} onClick={() => void remove(item.id)}>Xóa</button>
      </div>
    </article>)}</div>
    {items.length === 0 && <p>Chưa có nội dung được lưu.</p>}
    {message && <div className="runtime-message">{message}</div>}
  </section>
}
