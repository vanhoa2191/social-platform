import { useEffect, useState } from 'react'
import { deleteRemoteAiProfile, listRemoteAiProfiles, upsertRemoteAiProfile, type AiProfileRecord } from '../backend/repository'

export default function AiProfilesPanel() {
  const [items, setItems] = useState<AiProfileRecord[]>([])
  const [name, setName] = useState('')
  const [persona, setPersona] = useState('')
  const [editing, setEditing] = useState<AiProfileRecord | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function reload() {
    try {
      setItems(await listRemoteAiProfiles())
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không tải được dữ liệu Firebase.')
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(id)
  }, [])

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await upsertRemoteAiProfile({
        id: editing?.id,
        revision: editing?.revision,
        name: name.trim(),
        persona: persona.trim(),
        promptVersion: 'comment-v2',
        config: { strategy: 'INSIGHT', notes: '' },
      })
      setEditing(null)
      setName('')
      setPersona('')
      await reload()
      setMessage('Đã lưu profile trên Firebase.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể lưu profile.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: AiProfileRecord) {
    if (!item.id || !window.confirm(`Xóa AI Profile "${item.name}"?`)) return
    setBusy(true)
    try {
      await deleteRemoteAiProfile(item.id)
      if (editing?.id === item.id) { setEditing(null); setName(''); setPersona('') }
      await reload()
      setMessage('Đã xóa AI Profile.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể xóa AI Profile.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel">
    <div className="panel-head"><div><h3>Hồ sơ AI Firebase</h3><p>Cần cấu hình Firebase và đăng nhập để tạo hoặc chỉnh sửa.</p></div>
      <button className="secondary" onClick={() => void reload()}>Làm mới</button></div>
    <div className="gateway-form">
      <label>Tên profile<input maxLength={200} value={name} onChange={e => setName(e.target.value)}/></label>
      <label>Persona<input maxLength={2000} value={persona} onChange={e => setPersona(e.target.value)}/></label>
    </div>
    <div className="gateway-actions">
      <button className="primary" disabled={busy || !name.trim()} onClick={() => void save()}>{editing ? 'Lưu thay đổi' : 'Tạo AI Profile'}</button>
      {editing && <button className="secondary" onClick={() => { setEditing(null); setName(''); setPersona('') }}>Hủy sửa</button>}
    </div>
    <div className="crud-list">{items.map(item => <div key={item.id} className="crud-item">
      <div><strong>{item.name}</strong><p>{item.persona || 'Chưa có persona'}</p></div>
      <div className="gateway-actions">
        <button className="secondary" disabled={busy} onClick={() => { setEditing(item); setName(item.name); setPersona(item.persona ?? '') }}>Sửa</button>
        <button className="secondary" disabled={busy} onClick={() => void remove(item)}>Xóa</button>
      </div>
    </div>)}</div>
    {items.length === 0 && <p>Chưa có profile trên Firebase.</p>}
    {message && <div className="runtime-message">{message}</div>}
  </section>
}
