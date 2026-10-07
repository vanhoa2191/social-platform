import { useEffect, useMemo, useState } from 'react'
import { backendConfigured, firebaseRequiredOrigins, getBackendConfig } from '../backend/config'
import {
  createBackendAccount,
  getCurrentUserEmail,
  resolveScheduleConflictKeepLocal,
  resolveScheduleConflictUseCloud,
  sendBackendPasswordReset,
  signInBackend,
  signOutBackend,
  subscribeBackendAuth,
  syncRuntimeData,
} from '../backend/sync'
import {
  getRuntimeStatus,
  isExtensionRuntime,
  requestExternalOriginPermissions,
} from '../extension/client'
import type { SyncSummary } from '../backend/types'

type AuthMode = 'login' | 'register'

export default function BackendPanel() {
  const configured = backendConfigured()
  const backendConfig = getBackendConfig()
  const extensionMode = isExtensionRuntime()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [signedInEmail, setSignedInEmail] = useState<string | undefined>()
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [sync, setSync] = useState<SyncSummary | null>(null)
  const [version, setVersion] = useState('web-preview')

  const modeLabel = useMemo(
    () => {
      if (!configured) return 'Local-only mode'
      if (backendConfig?.useEmulators) return signedInEmail ? 'Firebase emulator connected' : 'Firebase emulator'
      return signedInEmail ? 'Firebase connected' : 'Firebase configured'
    },
    [backendConfig?.useEmulators, configured, signedInEmail],
  )

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

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

      unsubscribe = await subscribeBackendAuth((nextEmail) => {
        if (!cancelled) setSignedInEmail(nextEmail)
      })
    }

    void load()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [configured, extensionMode])

  async function ensureBackendPermission(): Promise<void> {
    if (!extensionMode) return
    const config = backendConfig
    if (!config) throw new Error('Firebase backend chưa được cấu hình.')
    const permission = await requestExternalOriginPermissions(firebaseRequiredOrigins(config))
    if (!permission.ok) throw new Error(permission.error)
    if (!permission.data.granted) throw new Error('Bạn chưa cấp quyền truy cập Firebase cho Extension.')
  }

  async function authenticate() {
    setStatus('loading')
    setMessage('')
    try {
      await ensureBackendPermission()
      if (authMode === 'register') {
        await createBackendAccount(email.trim(), password)
        setMessage('Đã tạo tài khoản Firebase và đăng nhập.')
      } else {
        await signInBackend(email.trim(), password)
        setMessage('Đăng nhập Firebase thành công.')
      }
      setPassword('')
      setStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Xác thực Firebase thất bại.')
      setStatus('error')
    }
  }

  async function resetPassword() {
    if (!email.includes('@')) {
      setMessage('Nhập email trước khi yêu cầu đặt lại mật khẩu.')
      return
    }
    setStatus('loading')
    try {
      await ensureBackendPermission()
      await sendBackendPasswordReset(email.trim())
      setMessage('Firebase đã gửi email đặt lại mật khẩu.')
      setStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không gửi được email đặt lại mật khẩu.')
      setStatus('error')
    }
  }

  async function syncNow() {
    setStatus('loading')
    setMessage('')
    try {
      await ensureBackendPermission()
      const result = await syncRuntimeData(version)
      setSync(result)
      setMessage(
        result.mode === 'connected'
          ? `Firebase sync xong: ${result.schedulesPushed} lịch và ${result.eventsPushed} event.`
          : 'Firebase chưa cấu hình. Hệ thống tiếp tục chạy local-only.',
      )
      setStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Đồng bộ Firebase thất bại.')
      setStatus('error')
    }
  }

  async function resolveConflict(scheduleId: string, choice: 'local' | 'cloud') {
    setStatus('loading')
    setMessage('')
    try {
      await ensureBackendPermission()
      const result = choice === 'local'
        ? await resolveScheduleConflictKeepLocal(scheduleId, version)
        : await resolveScheduleConflictUseCloud(scheduleId, version)
      setSync(result)
      setMessage(choice === 'local'
        ? 'Đã giữ bản local và đồng bộ lại Firebase.'
        : 'Đã áp dụng bản Firestore vào runtime local và đồng bộ lại.')
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
      setMessage('Đã đăng xuất Firebase.')
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
          <h3>Firebase Backend & Sync</h3>
          <p>
            Firebase Auth + Cloud Firestore cho cấu hình cloud. Browser runtime vẫn chạy local-first.
            {backendConfig?.useEmulators ? ' Đang dùng Firebase Emulator Suite.' : ''}
          </p>
        </div>
        <span className={configured ? 'backend-state connected' : 'backend-state local'}>{modeLabel}</span>
      </div>

      {!configured ? (
        <div className="backend-local-box">
          <strong>Chưa cấu hình Firebase project</strong>
          <span>
            App vẫn chạy local-only. Thêm Firebase Web config vào .env rồi bật Email/Password Auth và deploy Firestore Rules.
          </span>
        </div>
      ) : signedInEmail ? (
        <div className="backend-account-row">
          <div>
            <span>Firebase account</span>
            <strong>{signedInEmail}</strong>
          </div>
          <div className="button-row">
            <button className="secondary" disabled={status === 'loading'} onClick={() => void logout()}>Đăng xuất</button>
            <button className="primary" disabled={status === 'loading' || !extensionMode} onClick={() => void syncNow()}>
              {status === 'loading' ? 'Đang đồng bộ…' : '↻ Đồng bộ Firestore'}
            </button>
          </div>
        </div>
      ) : (
        <div className="firebase-auth-box">
          <div className="tabs">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Đăng nhập</button>
            <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Tạo tài khoản</button>
          </div>
          <div className="backend-login-row">
            <label>
              Email
              <input type="email" value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Mật khẩu
              <input type="password" value={password} minLength={6} placeholder="Ít nhất 6 ký tự" onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button className="primary" disabled={status === 'loading' || !email.includes('@') || password.length < 6} onClick={() => void authenticate()}>
              {status === 'loading' ? 'Đang xử lý…' : authMode === 'register' ? 'Tạo & đăng nhập' : 'Đăng nhập'}
            </button>
          </div>
          <button className="text-btn" disabled={status === 'loading' || !email.includes('@')} onClick={() => void resetPassword()}>
            Quên mật khẩu?
          </button>
        </div>
      )}

      <div className="backend-architecture">
        <div><strong>Local runtime</strong><span>Queue, locks, review candidates, session limits.</span></div>
        <div><strong>Firebase Auth</strong><span>{backendConfig?.useEmulators ? 'Auth Emulator' : 'Email/password qua firebase/auth/web-extension trên MV3.'}</span></div>
        <div><strong>Cloud Firestore</strong><span>{backendConfig?.useEmulators ? 'Firestore Emulator cho dev/test local.' : 'Campaigns, AI profiles, schedules và browser instances.'}</span></div>
        <div><strong>Security Rules</strong><span>Mọi cloud document nằm dưới users/&lt;uid&gt; và chỉ chủ sở hữu truy cập.</span></div>
      </div>

      {sync && (
        <>
          <div className="backend-sync-summary">
            <span>Provider: <b>Firebase</b></span>
            <span>Browser: <b>{sync.browserInstanceId?.slice(0, 8) ?? 'local'}</b></span>
            <span>Schedules: <b>{sync.schedulesPushed}</b></span>
            <span>Events: <b>{sync.eventsPushed}</b></span>
            <span>Remote schedules: <b>{sync.remoteSchedules}</b></span>
            <span>Conflicts: <b>{sync.conflicts}</b></span>
            <span>Telemetry: <b>{sync.telemetryEnabled ? 'opt-in' : 'off'}</b></span>
          </div>

          {sync.conflictScheduleIds.length > 0 && (
            <div className="backend-conflicts">
              <div>
                <strong>Có {sync.conflictScheduleIds.length} lịch Firestore mới hơn local</strong>
                <span>Chọn rõ nguồn dữ liệu để tránh overwrite âm thầm.</span>
              </div>
              {sync.conflictScheduleIds.map((scheduleId) => (
                <div className="backend-conflict-row" key={scheduleId}>
                  <code>{scheduleId}</code>
                  <div className="button-row">
                    <button className="secondary" disabled={status === 'loading'} onClick={() => void resolveConflict(scheduleId, 'cloud')}>Dùng bản Firestore</button>
                    <button className="primary" disabled={status === 'loading'} onClick={() => void resolveConflict(scheduleId, 'local')}>Giữ bản local</button>
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
