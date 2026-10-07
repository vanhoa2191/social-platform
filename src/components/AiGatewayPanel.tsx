import { useEffect, useMemo, useState } from 'react'
import { defaultAiGatewaySettings, type AiGatewaySettings } from '../ai/contracts'
import {
  getAiSettings,
  isExtensionRuntime,
  requestGatewayOriginPermission,
  saveAiSettings,
  testAiGateway,
} from '../extension/client'

export default function AiGatewayPanel() {
  const extensionMode = isExtensionRuntime()
  const [settings, setSettings] = useState<AiGatewaySettings>(defaultAiGatewaySettings)
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const [message, setMessage] = useState('')
  const [health, setHealth] = useState<{ provider: string; model: string; version: string } | null>(null)

  const gatewayEnabled = settings.mode === 'gateway'
  const modeLabel = useMemo(() => gatewayEnabled ? 'Gateway thật' : 'Local mock', [gatewayEnabled])

  useEffect(() => {
    if (!extensionMode) return
    let cancelled = false
    void getAiSettings().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setSettings(result.data.settings)
        setHasToken(result.data.hasToken)
      } else {
        setMessage(result.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [extensionMode])

  async function save() {
    if (!extensionMode) return
    setBusy('save')
    setMessage('')
    setHealth(null)

    try {
      if (settings.mode === 'gateway') {
        const permission = await requestGatewayOriginPermission(settings.gatewayUrl)
        if (!permission.ok) {
          setMessage(permission.error)
          return
        }
        if (!permission.data.granted) {
          setMessage('Chrome chưa cấp quyền truy cập origin của AI gateway.')
          return
        }
      }

      const result = await saveAiSettings(settings, token || undefined)
      if (result.ok) {
        setSettings(result.data.settings)
        setHasToken(result.data.hasToken)
        setToken('')
        setMessage('Đã lưu cấu hình AI.')
      } else {
        setMessage(result.error)
      }
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    if (!extensionMode) return
    setBusy('test')
    setMessage('')
    setHealth(null)
    try {
      const result = await testAiGateway()
      if (result.ok) {
        setHealth(result.data)
        setMessage('Kết nối AI gateway thành công.')
      } else {
        setMessage(result.error)
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="panel ai-gateway-panel">
      <div className="panel-head">
        <div>
          <h3>AI Gateway</h3>
          <p>API key của model nằm ở server. Extension chỉ giữ gateway token trong session.</p>
        </div>
        <span className={'gateway-mode ' + settings.mode}>{modeLabel}</span>
      </div>

      <div className="gateway-form">
        <label>
          Chế độ
          <select
            value={settings.mode}
            disabled={!extensionMode}
            onChange={(event) => setSettings({ ...settings, mode: event.target.value as AiGatewaySettings['mode'] })}
          >
            <option value="local">Local mock — không tốn API</option>
            <option value="gateway">AI Gateway — dùng model thật</option>
          </select>
        </label>

        <label>
          Prompt version
          <select
            value={settings.promptVersion}
            disabled={!extensionMode}
            onChange={(event) => setSettings({ ...settings, promptVersion: event.target.value as AiGatewaySettings['promptVersion'] })}
          >
            <option value="comment-v1">comment-v1</option>
            <option value="comment-v2">comment-v2 — khuyến nghị</option>
          </select>
        </label>

        <label className="gateway-url-field">
          Gateway URL
          <input
            value={settings.gatewayUrl}
            disabled={!extensionMode || !gatewayEnabled}
            placeholder="https://autotool-ai-gateway.example.workers.dev"
            onChange={(event) => setSettings({ ...settings, gatewayUrl: event.target.value })}
          />
        </label>

        <label>
          Timeout
          <select
            value={settings.timeoutMs}
            disabled={!extensionMode || !gatewayEnabled}
            onChange={(event) => setSettings({ ...settings, timeoutMs: Number(event.target.value) })}
          >
            <option value={10000}>10 giây</option>
            <option value={20000}>20 giây</option>
            <option value={30000}>30 giây</option>
            <option value={60000}>60 giây</option>
          </select>
        </label>

        <label className="gateway-token-field">
          Gateway token {hasToken && <span className="saved-token">đã có token trong session</span>}
          <input
            type="password"
            value={token}
            disabled={!extensionMode || !gatewayEnabled}
            placeholder={hasToken ? 'Để trống để giữ token hiện tại' : 'Bearer token của gateway'}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
      </div>

      <div className="gateway-actions">
        <button className="secondary" disabled={!extensionMode || !gatewayEnabled || busy !== null} onClick={() => void test()}>
          {busy === 'test' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
        </button>
        <button className="primary" disabled={!extensionMode || busy !== null} onClick={() => void save()}>
          {busy === 'save' ? 'Đang lưu…' : 'Lưu cấu hình'}
        </button>
      </div>

      {!extensionMode && <div className="runtime-note">AI Gateway chỉ cấu hình được khi dashboard đang chạy dưới Chrome Extension.</div>}
      {message && <div className="runtime-message">{message}</div>}
      {health && (
        <div className="gateway-health">
          <span>● Online</span>
          <strong>{health.provider}</strong>
          <span>{health.model}</span>
          <span>gateway {health.version}</span>
        </div>
      )}
    </section>
  )
}
