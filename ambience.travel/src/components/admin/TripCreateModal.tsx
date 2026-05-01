/* TripCreateModal.tsx
 * Modal form for creating a new travel_trips row, opened when an engagement
 * is dragged onto the "+ Drop here to create new trip" zone.
 *
 * Self-contained — uses A.* tokens, fetches no data on its own. Parent
 * provides the dragged engagement context + onSuccess callback. Modal does
 * the create + reassign in one shot, parent reloads.
 *
 * Last updated: S33B — initial ship.
 */

import { useEffect, useRef, useState } from 'react'
import { createTrip, reassignEngagementTrip } from '../../lib/adminEngagementQueries'
import { A } from '../../lib/adminTokens'

// ── Types ────────────────────────────────────────────────────────────────────

export type TripCreateModalProps = {
  // The engagement being dragged onto the create zone — for context label
  // and for the post-create reassignment.
  engagementId:    string
  engagementTitle: string | null
  engagementUrlId: string | null
  onClose:         () => void
  onSuccess:       (newTripId: string) => void
  showToast:       (msg: string, type: 'success' | 'error') => void
}

// ── Shared styles (matching EngagementsListTab) ──────────────────────────────

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   A.bgInput,
  border:       `1px solid ${A.border}`,
  borderRadius: 10,
  padding:      '10px 14px',
  fontSize:     13,
  color:        A.text,
  fontFamily:   A.font,
  outline:      'none',
  boxSizing:    'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize:      10,
  fontWeight:    700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color:         A.faint,
  fontFamily:    A.font,
  marginBottom:  6,
  display:       'block',
}

const btnPrimary: React.CSSProperties = {
  padding:       '8px 18px',
  background:    `rgba(216,181,106,0.12)`,
  color:         A.gold,
  border:        `1px solid rgba(216,181,106,0.30)`,
  borderRadius:  10,
  fontSize:      12,
  fontWeight:    700,
  fontFamily:    A.font,
  cursor:        'pointer',
  letterSpacing: '0.04em',
}

const btnGhost: React.CSSProperties = {
  padding:      '7px 16px',
  background:   'transparent',
  color:        A.muted,
  border:       `1px solid ${A.border}`,
  borderRadius: 10,
  fontSize:     12,
  fontWeight:   600,
  fontFamily:   A.font,
  cursor:       'pointer',
}

const helpStyle: React.CSSProperties = {
  fontSize:   11,
  color:      A.faint,
  fontFamily: A.font,
  marginTop:  4,
  lineHeight: 1.5,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TRIP_CODE_REGEX = /^[A-Z0-9]{3,8}-\d{4}-[A-Z0-9]{2,8}$/i

function suggestTripCode(engagementTitle: string | null): string {
  // Suggest a trip_code shape like NEW-YYYY-XX based on the engagement's
  // title — operator can edit before submit. Pure UX nicety; no DB call.
  const year = new Date().getFullYear()
  const titleSlug = (engagementTitle ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
  const prefix = titleSlug.length >= 3 ? titleSlug : 'NEW'
  return `${prefix}-${year}-XX`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TripCreateModal({
  engagementId,
  engagementTitle,
  engagementUrlId,
  onClose,
  onSuccess,
  showToast,
}: TripCreateModalProps) {
  const [tripCode, setTripCode]       = useState(() => suggestTripCode(engagementTitle))
  const [publicTitle, setPublicTitle] = useState('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [currency, setCurrency]       = useState('USD')
  const [saving, setSaving]           = useState(false)

  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
    firstFieldRef.current?.select()
  }, [])

  // Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  function validate(): string | null {
    const code = tripCode.trim()
    if (!code) return 'Trip code is required.'
    if (!TRIP_CODE_REGEX.test(code)) {
      return 'Trip code should look like ABC-2027-XX (letters, 4-digit year, suffix).'
    }
    if (startDate && endDate && endDate < startDate) {
      return 'End date cannot be before start date.'
    }
    return null
  }

  async function handleCreate() {
    const validationError = validate()
    if (validationError) {
      showToast(validationError, 'error')
      return
    }

    setSaving(true)
    try {
      const newTripId = await createTrip({
        trip_code:         tripCode.trim(),
        public_title:      publicTitle.trim() || null,
        start_date:        startDate || null,
        end_date:          endDate || null,
        currency:          currency.trim() || 'USD',
        primary_client_id: null,
      })
      await reassignEngagementTrip(engagementId, newTripId)
      showToast('Trip created. Engagement linked.', 'success')
      onSuccess(newTripId)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      // Common case: duplicate trip_code. Surface it cleanly.
      if (message.toLowerCase().includes('duplicate') || message.includes('23505')) {
        showToast(`Trip code "${tripCode.trim()}" already exists.`, 'error')
      }
      if (!message.toLowerCase().includes('duplicate') && !message.includes('23505')) {
        showToast(`Failed to create trip: ${message}`, 'error')
      }
    }
    setSaving(false)
  }

  function onBackdropClick(e: React.MouseEvent) {
    // Only close on direct backdrop click, never on click bubbling from inside.
    if (e.target === e.currentTarget && !saving) onClose()
  }

  const engagementBadge = engagementUrlId
    ? `${engagementTitle ?? '(untitled)'} · ${engagementUrlId}`
    : (engagementTitle ?? '(untitled)')

  return (
    <div
      onClick={onBackdropClick}
      style={{
        position: 'fixed',
        inset:    0,
        background: 'rgba(0,0,0,0.75)',
        zIndex:   1000,
        display:  'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding:  '40px 20px',
        overflowY: 'auto',
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='trip-create-title'
        style={{
          background:   A.bgCard,
          border:       `1px solid ${A.borderGold}`,
          borderRadius: 20,
          padding:      28,
          width:        '100%',
          maxWidth:     560,
          display:      'flex',
          flexDirection: 'column',
          gap:          18,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{
              fontSize:      10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color:         A.faint,
              fontFamily:    A.font,
              marginBottom:  4,
            }}>
              Create New Trip
            </div>
            <div id='trip-create-title' style={{
              fontSize:   18,
              fontWeight: 700,
              color:      A.text,
              fontFamily: A.font,
              letterSpacing: '-0.01em',
            }}>
              Link engagement to a new trip
            </div>
            <div style={{
              fontSize:   12,
              color:      A.muted,
              fontFamily: A.font,
              marginTop:  6,
            }}>
              Engagement <span style={{ color: A.gold, fontFamily: 'DM Mono, monospace' }}>{engagementBadge}</span> will be linked to the new trip on create.
            </div>
          </div>
          <button
            onClick={() => { if (!saving) onClose() }}
            disabled={saving}
            aria-label='Close'
            style={{
              background: 'none',
              border:     'none',
              color:      A.muted,
              fontSize:   22,
              cursor:     saving ? 'not-allowed' : 'pointer',
              lineHeight: 1,
              padding:    4,
              opacity:    saving ? 0.4 : 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Trip Code <span style={{ color: A.gold }}>*</span></label>
            <input
              ref={firstFieldRef}
              style={{ ...inputStyle, fontFamily: 'DM Mono, monospace' }}
              value={tripCode}
              onChange={e => setTripCode(e.target.value)}
              placeholder='YAZ-2027-HM'
              maxLength={32}
              disabled={saving}
            />
            <div style={helpStyle}>
              Operational identifier. Pattern: <span style={{ fontFamily: 'DM Mono, monospace', color: A.muted }}>PREFIX-YYYY-SUFFIX</span>. Must be unique.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Public Title</label>
            <input
              style={inputStyle}
              value={publicTitle}
              onChange={e => setPublicTitle(e.target.value)}
              placeholder='e.g. A Honeymoon Journey'
              disabled={saving}
            />
            <div style={helpStyle}>
              The human-readable name guests will see. Leave blank to set later.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input
                type='date'
                style={inputStyle}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input
                type='date'
                style={inputStyle}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Currency</label>
            <select
              style={inputStyle}
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              disabled={saving}
            >
              <option value='USD'>USD — US Dollar</option>
              <option value='EUR'>EUR — Euro</option>
              <option value='GBP'>GBP — British Pound</option>
              <option value='AED'>AED — UAE Dirham</option>
              <option value='SAR'>SAR — Saudi Riyal</option>
              <option value='CHF'>CHF — Swiss Franc</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display:   'flex',
          gap:       10,
          paddingTop: 12,
          borderTop: `1px solid ${A.border}`,
        }}>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{ ...btnPrimary, opacity: saving ? 0.5 : 1, cursor: saving ? 'wait' : 'pointer' }}
          >
            {saving && 'Creating…'}
            {!saving && 'Create Trip + Link'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ ...btnGhost, opacity: saving ? 0.4 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}