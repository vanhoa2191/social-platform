import { useState } from 'react'
import { isExtensionRuntime, saveSchedule } from '../extension/client'

export default function CampaignWizard({ close }: { close: () => void }) {
  const extensionMode = isExtensionRuntime()
  const [name, setName] = useState('Feed AI review')
  const [maxPosts, setMaxPosts] = useState(5)
  const [intervalMinutes, setIntervalMinutes] = useState(60)
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(22)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function createWorkflow() {
    if (!extensionMode) {
      setMessage('Hãy mở dashboard từ Chrome Extension để tạo workflow thật.')
      return
    }
    setBusy(true)
    const result = await saveSchedule({
      name,
      enabled: true,
      intervalMinutes,
      maxPosts,
      startHour,
      endHour,
    })
    setBusy(false)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage('Đã tạo workflow thật và bind với Facebook account đang được xác minh.')
  }

  return (
    <div className="modal-backdrop">
      <div className="wizard">
        <div className="wizard-head">
          <div>
            <h2>Tạo workflow pilot</h2>
            <p>Feed → AI draft → duyệt thủ công → chuẩn bị comment. AutoTool không tự bấm Gửi.</p>
          </div>
          <button className="icon-btn" onClick={close}>×</button>
        </div>
        <div className="wizard-body">
          <div className="runtime-note">
            Like, reaction, share, group/page automation và tự đăng bài chưa được bật trong bản beta.
          </div>
          <div className="form-grid">
            <div>
              <h3>Workflow hỗ trợ</h3>
              <label>Tên workflow<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
              <label>Số bài tối đa/lần<input type="number" min={1} max={20} value={maxPosts} onChange={(event) => setMaxPosts(Number(event.target.value))} /></label>
              <label>Chu kỳ<select value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))}>
                <option value={15}>15 phút</option><option value={30}>30 phút</option><option value={60}>60 phút</option><option value={120}>2 giờ</option>
              </select></label>
            </div>
            <div>
              <h3>Khung giờ</h3>
              <div className="two">
                <label>Bắt đầu<input type="number" min={0} max={23} value={startHour} onChange={(event) => setStartHour(Number(event.target.value))} /></label>
                <label>Kết thúc<input type="number" min={0} max={23} value={endHour} onChange={(event) => setEndHour(Number(event.target.value))} /></label>
              </div>
              <div className="summary-box">
                <p><b>Review:</b> Bắt buộc</p>
                <p><b>Approved draft:</b> Snapshot bất biến</p>
                <p><b>Submit:</b> Người dùng tự bấm trên Facebook</p>
              </div>
            </div>
          </div>
          {message && <div className="runtime-message">{message}</div>}
        </div>
        <div className="wizard-footer">
          <button className="secondary" onClick={close}>Đóng</button>
          <button className="primary" disabled={busy || !name.trim()} onClick={() => void createWorkflow()}>
            {busy ? 'Đang tạo…' : '✓ Tạo workflow thật'}
          </button>
        </div>
      </div>
    </div>
  )
}
