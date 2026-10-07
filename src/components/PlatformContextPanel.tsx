import { useEffect, useState } from 'react'
import {
  getAdapterDiagnostic,
  getPlatformContext,
  isExtensionRuntime,
} from '../extension/client'
import type { AdapterDiagnostic, PlatformContext } from '../platform/types'

export default function PlatformContextPanel() {
  const extensionMode = isExtensionRuntime()
  const [context, setContext] = useState<PlatformContext | null>(null)
  const [diagnostic, setDiagnostic] = useState<AdapterDiagnostic | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function refresh() {
    if (!extensionMode) return
    setLoading(true)
    setMessage('')
    const [contextResult, diagnosticResult] = await Promise.all([
      getPlatformContext(),
      getAdapterDiagnostic(),
    ])

    if (contextResult.ok) setContext(contextResult.data)
    else setMessage(contextResult.error)

    if (diagnosticResult.ok) setDiagnostic(diagnosticResult.data)
    else setMessage(diagnosticResult.error)

    setLoading(false)
  }

  useEffect(() => {
    if (!extensionMode) return
    let cancelled = false

    void Promise.all([getPlatformContext(), getAdapterDiagnostic()]).then(([contextResult, diagnosticResult]) => {
      if (cancelled) return
      if (contextResult.ok) setContext(contextResult.data)
      if (diagnosticResult.ok) setDiagnostic(diagnosticResult.data)
      if (!contextResult.ok) setMessage(contextResult.error)
      else if (!diagnosticResult.ok) setMessage(diagnosticResult.error)
    })

    return () => {
      cancelled = true
    }
  }, [extensionMode])

  const account = context?.account
  const healthClass = diagnostic?.health?.toLowerCase() ?? 'unknown'

  return (
    <section className="panel platform-context-panel">
      <div className="panel-head">
        <div>
          <h3>Facebook Browser Context</h3>
          <p>Account context được nhận diện từ DOM để khóa đúng tab, đúng lịch và đúng candidate.</p>
        </div>
        <div className="button-row">
          <span className={'adapter-health ' + healthClass}>
            {diagnostic ? diagnostic.health + ' · ' + diagnostic.adapterId : 'Chưa kiểm tra'}
          </span>
          <button className="secondary" disabled={!extensionMode || loading} onClick={() => void refresh()}>
            {loading ? 'Đang kiểm tra…' : '↻ Kiểm tra lại'}
          </button>
        </div>
      </div>

      {!extensionMode && (
        <div className="runtime-note">
          Account context chỉ được đọc khi dashboard chạy dưới Chrome Extension và có tab Facebook đang mở.
        </div>
      )}

      {message && <div className="runtime-message">{message}</div>}

      {extensionMode && (
        <div className="context-grid">
          <div className="context-card">
            <span>Account</span>
            <strong>{account?.label ?? 'Chưa nhận diện'}</strong>
            <small>{account?.verified ? '✓ Context đã đủ bằng chứng để bind scheduler' : 'Chưa đủ bằng chứng để bind scheduler'}</small>
          </div>
          <div className="context-card">
            <span>Context key</span>
            <strong className="mono-value">{account?.key ?? '—'}</strong>
            <small>{account?.confidence ? 'Confidence: ' + account.confidence : 'Không có context'}</small>
          </div>
          <div className="context-card">
            <span>Surface</span>
            <strong>{context?.surface ?? 'UNKNOWN'}</strong>
            <small>{context?.url ? new URL(context.url).pathname || '/' : '—'}</small>
          </div>
          <div className="context-card">
            <span>Adapter DOM</span>
            <strong>{diagnostic?.health ?? '—'}</strong>
            <small>
              {diagnostic ? diagnostic.articleCount + ' article · ' + diagnostic.composerCount + ' composer · ' + diagnostic.accountEvidenceCount + ' account evidence' : '—'}
            </small>
          </div>
        </div>
      )}

      {diagnostic?.warnings?.length ? (
        <div className="adapter-warnings">
          {diagnostic.warnings.map((warning) => <span key={warning}>! {warning}</span>)}
        </div>
      ) : null}
    </section>
  )
}
