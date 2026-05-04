/* DeleteEngagementModal.tsx
 * 4-step destructive confirmation for deleting an engagement.
 * Pattern mirrors SPORTS DeleteSystemSection (3 gating steps + execute).
 *
 * Steps:
 *   1 · Cascade warning — explicit list of what gets deleted, [I understand]
 *   2 · Type-to-confirm — user must type the engagement title exactly
 *   3 · Final confirmation — last-chance copy, destructive red button
 *   4 · Execute — busy spinner → success or error
 *
 * No backup integration — the cascade hits 10 tables and a CSV is not
 * sensibly recoverable. Scheduled backups are a separate workstream
 * (S335 carry-forward).
 *
 * Last updated: S334
 */

import { useState } from 'react'
import { A } from '../../lib/adminTokens'

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: A.text,
  fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
}

const btnGhost: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  padding: '8px 18px', background: 'rgba(239,68,68,0.12)', color: A.danger,
  border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 10,
  fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer',
  letterSpacing: '0.04em',
}

const btnDangerSolid: React.CSSProperties = {
  padding: '10px 20px', background: A.danger, color: '#FFFFFF',
  border: `1px solid ${A.danger}`, borderRadius: 10,
  fontSize: 13, fontWeight: 700, fontFamily: A.font, cursor: 'pointer',
  letterSpacing: '0.04em',
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: 'Review' },
    { n: 2, label: 'Confirm name' },
    { n: 3, label: 'Final check' },
    { n: 4, label: 'Done' },
  ]

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
      {steps.map((s, i) => {
        const isActive = current === s.n
        const isPast   = current > s.n
        const dotColor = isPast ? A.danger : isActive ? A.danger : A.faint
        const labelColor = isActive ? A.text : A.faint
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11,
              border: `1.5px solid ${dotColor}`,
              background: isPast ? A.danger : 'transparent',
              color: isPast ? '#FFFFFF' : dotColor,
              fontSize: 11, fontWeight: 700, fontFamily: A.font,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {isPast ? '✓' : s.n}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              color: labelColor, fontFamily: A.font,
              textTransform: 'uppercase',
            }}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div style={{
                width: 16, height: 1, background: A.border, marginLeft: 2,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────

export default function DeleteEngagementModal({
  title,
  urlId,
  onClose,
  onConfirm,
}: {
  title:     string
  urlId:     string
  onClose:   () => void
  onConfirm: () => Promise<void>
}) {
  const [step,    setStep]    = useState<1 | 2 | 3 | 4>(1)
  const [confirm, setConfirm] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [done,    setDone]    = useState(false)
  const [errMsg,  setErrMsg]  = useState('')

  const expectedConfirm = title.trim()
  const matches = confirm.trim() === expectedConfirm && expectedConfirm.length > 0

  async function handleExecute() {
    setBusy(true)
    setErrMsg('')
    setStep(4)
    try {
      await onConfirm()
      setDone(true)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      setErrMsg(message)
      setBusy(false)
    }
  }

  function handleClose() {
    // Block closing while the delete is in flight
    if (busy && !errMsg) return
    onClose()
  }

  // ── Step content ───────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <>
        <div style={{ fontSize: 14, color: A.text, fontFamily: A.font, lineHeight: 1.7 }}>
          You're about to permanently delete <strong style={{ color: A.danger }}>{title}</strong>.
          {' '}This will remove the entire engagement and all of its content from the database.
        </div>

        <div style={{
          padding: '14px 16px', borderRadius: 10,
          background: 'rgba(239,68,68,0.06)',
          border: `1px solid rgba(239,68,68,0.3)`,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: A.danger, fontFamily: A.font,
            marginBottom: 8,
          }}>
            What will be deleted
          </div>
          <div style={{ fontSize: 12, color: A.text, fontFamily: A.font, lineHeight: 1.8 }}>
            <div>• Route stops on this proposal</div>
            <div>• Destination rows and per-destination overrides</div>
            <div>• Pricing rows (overview + destination subpages)</div>
            <div>• Hotel selections (flat + regioned)</div>
            <div>• Region groupings</div>
            <div>• Card selections + customisations (dining + experiences)</div>
            <div>• Room overlays and per-engagement room curation</div>
            <div>• Display name overrides</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
          Canonical content (hotels, rooms, dining venues, experiences, destinations) is
          <em> not </em>affected — only the engagement-specific content for this proposal.
          {' '}<strong style={{ color: A.text }}>This action cannot be undone.</strong>
        </div>

        <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={() => setStep(2)} style={{ ...btnDanger, marginLeft: 'auto' }}>
            I understand — continue
          </button>
        </div>
      </>
    )
  }

  function renderStep2() {
    return (
      <>
        <div style={{ fontSize: 14, color: A.text, fontFamily: A.font, lineHeight: 1.7 }}>
          To confirm you mean to delete this engagement, please type its title exactly:
        </div>

        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: A.bgInput, border: `1px solid ${A.border}`,
          fontFamily: 'DM Mono, monospace', fontSize: 13, color: A.gold,
          userSelect: 'all',
        }}>
          {expectedConfirm}
        </div>

        <input
          style={{
            ...inputStyle,
            borderColor: matches ? A.positive : A.border,
            fontFamily: 'DM Mono, monospace',
          }}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder='Type the title here…'
          autoFocus
        />

        {confirm.length > 0 && !matches && (
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
            Doesn't match yet. Spaces and capitalisation must be exact.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
          <button onClick={() => { setStep(1); setConfirm('') }} style={btnGhost}>← Back</button>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button
            onClick={() => setStep(3)}
            disabled={!matches}
            style={{ ...btnDanger, marginLeft: 'auto', opacity: matches ? 1 : 0.4, cursor: matches ? 'pointer' : 'not-allowed' }}
          >
            Continue
          </button>
        </div>
      </>
    )
  }

  function renderStep3() {
    return (
      <>
        <div style={{ fontSize: 14, color: A.text, fontFamily: A.font, lineHeight: 1.7 }}>
          Last check.
        </div>

        <div style={{
          padding: '16px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)',
          border: `1px solid rgba(239,68,68,0.4)`,
        }}>
          <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, lineHeight: 1.7 }}>
            You're permanently deleting <strong style={{ color: A.danger }}>{title}</strong>.
            {' '}This removes the engagement from <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: A.muted }}>{urlId}</code>
            {' '}and cascades through all child content.
          </div>
          <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, lineHeight: 1.7, marginTop: 10 }}>
            <strong>This cannot be undone.</strong>
          </div>
        </div>

        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
          If this is a live proposal, double-check with the team or the client first.
          A deleted engagement cannot be recovered.
        </div>

        <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
          <button onClick={() => setStep(2)} style={btnGhost}>← Back</button>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={handleExecute} style={{ ...btnDangerSolid, marginLeft: 'auto' }}>
            Delete permanently
          </button>
        </div>
      </>
    )
  }

  function renderStep4() {
    if (errMsg) {
      return (
        <>
          <div style={{
            padding: '16px 18px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)',
            border: `1px solid rgba(239,68,68,0.4)`,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: A.danger, fontFamily: A.font,
              marginBottom: 8,
            }}>
              Delete failed
            </div>
            <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, lineHeight: 1.6 }}>
              {errMsg}
            </div>
          </div>

          <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
            The engagement was not deleted. You can retry, or close this dialog and try again later.
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
            <button onClick={onClose} style={btnGhost}>Close</button>
            <button
              onClick={handleExecute}
              style={{ ...btnDangerSolid, marginLeft: 'auto' }}
            >
              Retry
            </button>
          </div>
        </>
      )
    }

    if (done) {
      return (
        <>
          <div style={{
            padding: '20px 18px', borderRadius: 10,
            background: 'rgba(122,171,107,0.08)',
            border: `1px solid rgba(122,171,107,0.4)`,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: A.positive, color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, fontFamily: A.font, flexShrink: 0,
            }}>
              ✓
            </div>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: A.positive, fontFamily: A.font,
                marginBottom: 4,
              }}>
                Deleted
              </div>
              <div style={{ fontSize: 13, color: A.text, fontFamily: A.font }}>
                <strong>{title}</strong> has been removed.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
            <button onClick={onClose} style={{ ...btnGhost, marginLeft: 'auto' }}>
              Back to engagements
            </button>
          </div>
        </>
      )
    }

    // Busy state
    return (
      <div style={{
        padding: '32px 18px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 14,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 16,
          border: `2px solid ${A.border}`,
          borderTopColor: A.danger,
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 13, color: A.text, fontFamily: A.font }}>
          Deleting…
        </div>
        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
          Don't close this window.
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 9500,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '60px 20px', overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        background: A.bg, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 20,
        padding: 28, width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{
              fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: A.danger, fontWeight: 700, fontFamily: A.font, marginBottom: 4,
            }}>
              Delete Engagement
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {step === 4 && done ? 'Deleted' : 'This cannot be undone'}
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={busy && !errMsg}
            style={{
              background: 'none', border: 'none',
              color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1,
              opacity: busy && !errMsg ? 0.3 : 1,
            }}
          >
            ✕
          </button>
        </div>

        <StepIndicator current={step} />

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  )
}