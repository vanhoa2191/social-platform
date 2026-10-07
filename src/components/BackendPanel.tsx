import { useEffect, useMemo, useState } from 'react'
import { backendConfigured } from '../backend/config'
import { getSupabaseClient } from '../backend/client'
import {
  getCurrentUserEmail,
  resolveScheduleConflictKeepLocal,
  resolveScheduleConflictUseCloud,
  sendMagicLink,
  signOutBackend,
  syncRuntimeData,
} from '../backend/sync'
import { getRuntimeStatus, isExtensionRuntime } from '../extension/client'
import type { SyncSummary } from '../backend/types'

export default function BackendPanel() {
  const configured = backendConfigured()
  const extensionMode = isExtensionRuntime()
  const [email, setEmail] = useState('')
  const [signedInEmail, setSignedInEmail] = useState<string | undefined>()
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [sync, setSync] = useState<SyncSummary | null>(null)
  const [version, setVersion] = useState('web-preview')

  const modeLabel = useMemo(
    () => configured ? (signedInEmail ? 'Cloud sync connected' : 'Backend configured') : 'Local-only mode',
    [configured, signedInEmail],
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (extensionMode) {
        const runtime = await getRuntimeStatus()
        if (!cancelled && runtime.ok) setVersion(runtime.data.version)
      }

      if (!configured) return
      const current = await getCurrentUserEmail()
      if (!cancelled) {
        setSignedInEmail(current)
        setStatus('ready')
      }
    }

    void load()

    const client = getSupabaseClient()
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setSignedInEmail(session?.user.email)
    })

    return () => {
      cancelled = true
      subscription?.data.subscription.unsubscribe()
    }
  }, [configured, extensionMode])

  async function magicLink() {
    setStatus('loading')
    setMessage('')
    try {
      await sendMagicLink(email.trim())
      setMessage('Đã gửi magic link. Mở email trên cùng trình duyệt để hoàn tất đăng nhập.')
      setStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không gửi được magic link.')
      setStatus('error')
    }
  }

  async function syncNow() {
    setStatus('loading')
    setMessage('')
    try {
      const result = await syncRuntimeData(version)
      setSync(result)
      setMessage(
        result.mode === 'connected'
          ? `Đồng bộ xong: ${result.schedulesPushed} lịch và ${result.eventsPushed} event.`
          : 'Backend chưa cấu hình. Hệ thống tiếp tục chạy local-only.',
      )
      setStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Đồng bộ thất bại.')
      setStatus('error')
    }
  }

  async function resolveConflict(scheduleId: string, choice: 'local' | 'cloud') {
    setStatus('loading')
    setMessage('')
    try {
      const result = choice === 'local'
        ? await resolveScheduleConflictKeepLocal(scheduleId, version)
        : await resolveScheduleConflictUseCloud(scheduleId, version)
      setSync(result)
      setMessage(
        choice === 'local'
          ? 'Đã giữ bản local và đồng bộ lại.'
          : 'Đã áp dụng bản cloud vào runtime local và đồng bộ lại.',
      )
      setStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không giải quyết được conflict.')
      setStatus('error')
    }
  }

  async function logout() {
    setStatus('loading')
    try {
      await signOutBackend()
      setSignedInEmail(undefined)
      setSync(null)
      setMessage('Đã đăng xuất backend.')
      setStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Đăng xuất thất bại.')
      setStatus('error')
    }
  }

  return (
    <section className="panel backend-panel">
      <div className="panel-head">
        <div>
          <h3>Backend & Sync</h3>
          <p>Supabase/PostgreSQL dùng cho Auth, cấu hình dùng chung và analytics. Browser runtime vẫn chạy local-first.</p>
        </div>
        <span className={configured ? 'backend-state connected' : 'backend-state local'}>
          {modeLabel}
        </span>
      </div>

      {!configured ? (
        <div className="backend-local-box">
          <strong>Chưa cấu hình Supabase project</strong>
          <span>App vẫn hoạt động bình thường ở local-only mode. Thêm VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY khi có project.</span>
        </div>
      ) : signedInEmail ? (
        <div className="backend-account-row">
          <div>
            <span>Tài khoản backend</span>
            <strong>{signedInEmail}</strong>
          </div>
          <div className="button-row">
            <button className="secondary" disabled={status === 'loading'} onClick={() => void logout()}>Đăng xuất</button>
            <button className="primary" disabled={status === 'loading' || !extensionMode} onClick={() => void syncNow()}>
              {status === 'loading' ? 'Đang đồng bộ…' : '↻ Đồng bộ ngay'}
            </button>
          </div>
        </div>
      ) : (
        <div className="backend-login-row">
          <label>
            Email đăng nhập
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="primary" disabled={status === 'loading' || !email.includes('@')} onClick={() => void magicLink()}>
            Gửi magic link
          </button>
        </div>
      )}

      <div className="backend-architecture">
        <div><strong>Local runtime</strong><span>Queue, locks, review candidates, session limits.</span></div>
        <div><strong>Cloud config</strong><span>Campaigns, AI profiles, schedule definitions.</span></div>
        <div><strong>Analytics</strong><span>Runtime events được đẩy lên theo watermark.</span></div>
        <div><strong>Security</strong><span>Publishable key + Auth JWT + RLS; không dùng service role trong extension.</span></div>
      </div>

      {sync && (
        <>
          <div className="backend-sync-summary">
            <span>Browser: <b>{sync.browserInstanceId?.slice(0, 8) ?? 'local'}</b></span>
            <span>Schedules: <b>{sync.schedulesPushed}</b></span>
            <span>Events: <b>{sync.eventsPushed}</b></span>
            <span>Remote schedules: <b>{sync.remoteSchedules}</b></span>
            <span>Conflicts: <b>{sync.conflicts}</b></span>
          </div>

          {sync.conflictScheduleIds.length > 0 && (
            <div className="backend-conflicts">
              <div>
                <strong>Có {sync.conflictScheduleIds.length} lịch cloud mới hơn local</strong>
                <span>Chọn rõ nguồn dữ liệu để tránh overwrite âm thầm.</span>
              </div>
              {sync.conflictScheduleIds.map((scheduleId) => (
                <div className="backend-conflict-row" key={scheduleId}>
                  <code>{scheduleId}</code>
                  <div className="button-row">
                    <button
                      className="secondary"
                      disabled={status === 'loading'}
                      onClick={() => void resolveConflict(scheduleId, 'cloud')}
                    >
                      Dùng bản cloud
                    </button>
                    <button
                      className="primary"
                      disabled={status === 'loading'}
                      onClick={() => void resolveConflict(scheduleId, 'local')}
                    >
                      Giữ bản local
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {message && <div className={status === 'error' ? 'backend-message error' : 'backend-message'}>{message}</div>}
    </section>
  )
}
