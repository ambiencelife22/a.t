/* AuxPassengersEditor.tsx
 * Shared per-flight passenger editor. Lifted verbatim from the inline
 * PassengersSubEditor in EngagementDossierSection.tsx (S54) so both the dossier
 * AuxBookingsEditor and BriefEditorPage's BriefAuxEditor edit passengers
 * from a single source.
 *
 * Each passenger: label + conf + seats, on travel_engagement_passengers.
 * Seats and confirmation numbers are per-passenger here — the parent
 * travel_engagement_aux_bookings row no longer carries them (S54b cleanup).
 * person_id wiring deferred to a picker; passenger_label is the
 * operator-facing field for now.
 *
 * Self-contained: own field component + styles, zero back-dependency on
 * either parent editor.
 */

import { useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { useAdminToast } from './_adminPrimitives'
import { PersonLinkPicker } from './PersonLinkPicker'
import {
  createAuxPassenger, updateAuxPassenger, deleteAuxPassenger,
} from '../../queries/queriesAdminJourney'
import type { ElementPassenger, ElementPassengerPatch } from '../../queries/queriesAdminJourney'
import { passengerName } from '../../utils/utilsRoomDisplay'

// ── Local styles + field ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text, background: A.bg,
  border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 8px',
  width: '100%', boxSizing: 'border-box' as const, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, marginBottom: 3, display: 'block',
}

function PaxField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

// ── Draft + mappers ─────────────────────────────────────────────────────────────

type PaxDraft = {
  person_id:           string | null
  passenger_label:     string
  confirmation_number: string
  seat_numbers:        string
  sort_order:          number
}

function emptyPaxDraft(sortOrder: number): PaxDraft {
  return { person_id: null, passenger_label: '', confirmation_number: '', seat_numbers: '', sort_order: sortOrder }
}

function paxToDraft(p: ElementPassenger): PaxDraft {
  return {
    person_id:           p.person_id            ?? null,
    passenger_label:     p.passenger_label     ?? '',
    confirmation_number: p.confirmation_number  ?? '',
    seat_numbers:        p.seat_numbers         ?? '',
    sort_order:          p.sort_order,
  }
}

function paxDraftToPatch(d: PaxDraft): ElementPassengerPatch {
  const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim())
  return {
    person_id:           d.person_id,
    passenger_label:     orNull(d.passenger_label),
    confirmation_number: orNull(d.confirmation_number),
    seat_numbers:        orNull(d.seat_numbers),
    sort_order:          d.sort_order,
  }
}

// ── AuxPassengersEditor ───────────────────────────────────────────────────────

export function AuxPassengersEditor({ auxBookingId, initial, partyLabel }: { auxBookingId: string; initial: ElementPassenger[]; partyLabel?: string | null }) {
  const [pax,    setPax]    = useState<ElementPassenger[]>(initial)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft,  setDraft]  = useState<PaxDraft>(emptyPaxDraft(0))
  const [saving, setSaving] = useState(false)
  const [linkedName, setLinkedName] = useState<string | null>(null)
  const { success, error } = useAdminToast()

  const sorted = [...pax].sort((a, b) => a.sort_order - b.sort_order)

  function beginAdd() {
    setEditId(null)
    setDraft(emptyPaxDraft(pax.length))
    setAdding(true)
  }
  function beginEdit(p: ElementPassenger) {
    setAdding(false)
    setEditId(p.id)
    setDraft(paxToDraft(p))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const patch = paxDraftToPatch(draft)
      if (editId) {
        const updated = await updateAuxPassenger(editId, patch)
        setPax(prev => prev.map(p => p.id === editId ? updated : p))
        setEditId(null)
        success('Passenger updated')
        return
      }
      const created = await createAuxPassenger(auxBookingId, patch)
      setPax(prev => [...prev, created])
      setAdding(false)
      success('Passenger added')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to save passenger') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await deleteAuxPassenger(id)
      setPax(prev => prev.filter(p => p.id !== id))
      success('Passenger removed')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to delete passenger') }
    finally { setSaving(false) }
  }

  const form = (
    <div style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <PersonLinkPicker
          label='Passenger (global registry)'
          personId={draft.person_id}
          onChange={pid => setDraft({ ...draft, person_id: pid })}
          onResolved={setLinkedName}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PaxField label='Label (override)' value={draft.passenger_label} onChange={v => setDraft({ ...draft, passenger_label: v })} placeholder={draft.person_id ? 'Using linked person' : (partyLabel ? `Resolves to: ${partyLabel}` : 'e.g. Ms. Sayegh')} />
        <PaxField label='Confirmation #' value={draft.confirmation_number} onChange={v => setDraft({ ...draft, confirmation_number: v })} placeholder='PVJZEW' />
        <PaxField label='Seat Numbers' value={draft.seat_numbers} onChange={v => setDraft({ ...draft, seat_numbers: v })} placeholder='5F, 5E' />
        <PaxField label='Sort Order' type='number' value={String(draft.sort_order)} onChange={v => setDraft({ ...draft, sort_order: parseInt(v, 10) || 0 })} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={() => { setAdding(false); setEditId(null) }} style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: A.faint, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: '#0F1110', background: A.gold, border: 'none', borderRadius: 5, padding: '4px 12px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : (editId ? 'Save' : 'Add')}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: `2px solid ${A.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
          Passengers ({pax.length})
        </div>
        {!adding && !editId && (
          <button onClick={beginAdd} style={{ fontFamily: A.font, fontSize: 9, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
            + Passenger
          </button>
        )}
      </div>

      {sorted.map(p => (
        editId === p.id ? (
          <div key={p.id} style={{ marginBottom: 6 }}>{form}</div>
        ) : (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '4px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: A.text, fontFamily: A.font }}>{p.resolved_passenger_label || p.passenger_label || 'Guest'}</span>
              <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', marginLeft: 8 }}>
                {[p.confirmation_number, p.seat_numbers ? `Seats ${p.seat_numbers}` : null].filter(Boolean).join('  ·  ')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => beginEdit(p)} style={{ fontFamily: A.font, fontSize: 9, color: A.gold, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Edit</button>
              <button onClick={() => handleDelete(p.id)} disabled={saving} style={{ fontFamily: A.font, fontSize: 9, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>×</button>
            </div>
          </div>
        )
      ))}

      {adding && <div style={{ marginTop: 6 }}>{form}</div>}
    </div>
  )
}