import { useEffect, useMemo, useState } from 'react'
import {
  getPilotSettings,
  getRuntimeStatus,
  isExtensionRuntime,
  savePilotSettings,
} from '../extension/client'
import { defaultPilotSettings, type PilotSettings } from '../extension/pilot'
import type { RuntimeStatus } from '../extension/types'

interface Check {
  label: string
  state: 'PASS' | 'WARN' | 'BLOCKED'
  detail: string
}

export default function PilotReadinessPanel() {
  const extensionMode = isExtensionRuntime()
  const [settings, setSettings] = useState<PilotSettings>(defaultPilotSettings)
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function refresh() {
    if (!extensionMode) return
    const [pilotResult, runtimeResult] = await Promise.all([
      getPilotSettings(),
      getRuntimeStatus(),
    ])
    if (pilotResult.ok) setSettings(pilotResult.data)
    else setMessage(pilotResult.error)
    if (runtimeResult.ok) setRuntime(runtimeResult.data)
    else setMessage(runtimeResult.error)
  }

  useEffect(() => {
    if (!extensionMode) return
    let cancelled = false

    void Promise.all([getPilotSettings(), getRuntimeStatus()]).then(([pilotResult, runtimeResult]) => {
      if (cancelled) return
      if (pilotResult.ok) setSettings(pilotResult.data)
      if (runtimeResult.ok) setRuntime(runtimeResult.data)
      if (!pilotResult.ok) setMessage(pilotResult.error)
      else if (!runtimeResult.ok) setMessage(runtimeResult.error)
    })

    return () => {
      cancelled = true
    }
  }, [extensionMode])

  async function update(next: PilotSettings) {
    if (!extensionMode) return
    setBusy(true)
    setMessage('')
    const result = await savePilotSettings(next)
    if (result.ok) {
      setSettings(result.data)
      setMessage('Đã lưu cấu hình pilot.')
      await refresh()
    } else {
      setMessage(result.error)
    }
    setBusy(false)
  }

  const checks = useMemo<Check[]>(() => {
    if (!extensionMode) {
      return [{
        label: 'Chrome Extension runtime',
        state: 'BLOCKED',
        detail: 'Web preview không thể chạy pilot browser runtime.',
      }]
    }

    return [
      {
        label: 'Runtime database',
        state: runtime?.runtimeDbSchemaVersion === 5 ? 'PASS' : 'BLOCKED',
        detail: runtime
          ? `IndexedDB v${runtime.runtimeDbVersion}, schema ${runtime.runtimeDbSchemaVersion ?? 'unknown'}`
          : 'Chưa đọc được runtime DB.',
      },
      {
        label: 'Facebook account context',
        state: runtime?.platformContext?.account?.verified ? 'PASS' : 'WARN',
        detail: runtime?.platformContext?.account?.verified
          ? `Đã bind: ${runtime.platformContext.account.label}`
          : 'Mở Facebook và đăng nhập đúng account trước khi pilot.',
      },
      {
        label: 'Facebook adapter',
        state: runtime?.adapterDiagnostic?.health === 'HEALTHY'
          ? 'PASS'
          : runtime?.adapterDiagnostic?.health === 'DEGRADED'
            ? 'WARN'
            : 'BLOCKED',
        detail: runtime?.adapterDiagnostic
          ? `${runtime.adapterDiagnostic.adapterId} · ${runtime.adapterDiagnostic.health}`
          : 'Chưa có adapter diagnostic.',
      },
      {
        label: 'Safety controls',
        state: runtime?.safety.emergencyStop ? 'WARN' : 'PASS',
        detail: runtime?.safety.emergencyStop
          ? 'Emergency Stop đang bật; automation sẽ không chạy.'
          : `Giới hạn phiên hiệu dụng: ${runtime?.maxSessionActions ?? settings.maxActionsPerSession}`,
      },
      {
        label: 'Pilot workload cap',
        state: settings.enabled ? 'PASS' : 'WARN',
        detail: settings.enabled
          ? `Tối đa ${settings.maxPostsPerRun} bài/lần và ${settings.maxActionsPerSession} thao tác/phiên.`
          : 'Pilot mode đang tắt; giới hạn cấu hình chính sẽ được dùng.',
      },
      {
        label: 'Telemetry',
        state: 'PASS',
        detail: settings.telemetryOptIn
          ? 'Đã opt-in. Chỉ category/level/timestamp được gửi; message/detail không được upload.'
          : 'Đang tắt mặc định. Không gửi runtime event lên backend.',
      },
    ]
  }, [extensionMode, runtime, settings])

  const blocked = checks.filter((item) => item.state === 'BLOCKED').length
  const warnings = checks.filter((item) => item.state === 'WARN').length

  return (
    <section className="panel pilot-panel">
      <div className="panel-head">
        <div>
          <h3>Pilot Readiness</h3>
          <p>Chế độ thử nghiệm có giới hạn nhỏ, kiểm tra context và telemetry chỉ bật khi người dùng đồng ý.</p>
        </div>
        <span className={blocked ? 'pilot-state blocked' : warnings ? 'pilot-state warn' : 'pilot-state ready'}>
          {blocked ? `${blocked} blocked` : warnings ? `${warnings} warning` : 'Ready for pilot'}
        </span>
      </div>

      <div className="pilot-controls">
        <label className="pilot-toggle-card">
          <div>
            <strong>Pilot mode</strong>
            <span>Giảm phạm vi chạy để test có kiểm soát trước khi production.</span>
          </div>
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={!extensionMode || busy}
            onChange={(event) => void update({ ...settings, enabled: event.target.checked })}
          />
        </label>

        <label className="pilot-toggle-card">
          <div>
            <strong>Opt-in error telemetry</strong>
            <span>Mặc định tắt. Không gửi nội dung bài, comment, message hoặc detail.</span>
          </div>
          <input
            type="checkbox"
            checked={settings.telemetryOptIn}
            disabled={!extensionMode || busy}
            onChange={(event) => void update({ ...settings, telemetryOptIn: event.target.checked })}
          />
        </label>

        <label>
          Bài tối đa/lần
          <input
            type="number"
            min={1}
            max={20}
            value={settings.maxPostsPerRun}
            disabled={!extensionMode || busy || !settings.enabled}
            onChange={(event) => setSettings({ ...settings, maxPostsPerRun: Number(event.target.value) })}
            onBlur={() => void update(settings)}
          />
        </label>

        <label>
          Thao tác tối đa/phiên
          <input
            type="number"
            min={1}
            max={50}
            value={settings.maxActionsPerSession}
            disabled={!extensionMode || busy || !settings.enabled}
            onChange={(event) => setSettings({ ...settings, maxActionsPerSession: Number(event.target.value) })}
            onBlur={() => void update(settings)}
          />
        </label>
      </div>

      <div className="pilot-checks">
        {checks.map((check) => (
          <div className="pilot-check" key={check.label}>
            <span className={'pilot-check-state ' + check.state.toLowerCase()}>{check.state}</span>
            <div>
              <strong>{check.label}</strong>
              <span>{check.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="button-row pilot-actions">
        <button className="secondary" disabled={!extensionMode || busy} onClick={() => void refresh()}>
          ↻ Chạy kiểm tra lại
        </button>
        {runtime && <span className="pilot-version">v{runtime.version} · {runtime.releaseChannel}</span>}
      </div>

      {message && <div className="runtime-message">{message}</div>}
    </section>
  )
}
