/* AuxDriverDetailsEditor.tsx
 * Per-ground-car-service driver/vehicle editor. Structural twin of
 * AuxPassengersEditor — mounted under Transfer / Airport Transfer / Car Service
 * aux bookings in the dossier AuxBookingsEditor.
 *
 * Each row = one vehicle (driver name/phone, car model, plate, company, role).
 * Some clients run 5 vehicles per service (principal/staff/luggage) — vehicle_role
 * labels which car. company is operator-internal; the client confirmation/programme
 * pages omit it (the client EFs never select it).
 *
 * Rows live on travel_aux_driver_details. Loads its own initial set on mount
 * (the aux booking row doesn't carry them).
 */

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { useAdminToast } from './_adminPrimitives'
import {
  fetchAuxDriverDetails, createAuxDriverDetail, updateAuxDriverDetail, deleteAuxDriverDetail,
} from '../../queries/queriesAdminJourney'
import type { ElementDriverDetail, ElementDriverDetailPatch } from '../../queries/queriesAdminJourney'

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

function VehField({ label, value, onChange, placeholder, type = 'text' }: {
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

type VehDraft = {
  driver_name: string; driver_phone: string; car_model: string
  plate: string; company: string; vehicle_role: string; sort_order: number
}

function emptyVehDraft(sortOrder: number): VehDraft {
  return { driver_name: '', driver_phone: '', car_model: '', plate: '', company: '', vehicle_role: '', sort_order: sortOrder }
}
function vehToDraft(v: ElementDriverDetail): VehDraft {
  return {
    driver_name:  v.driver_name  ?? '',
    driver_phone: v.driver_phone ?? '',
    car_model:    v.car_model    ?? '',
    plate:        v.plate        ?? '',
    company:      v.company      ?? '',
    vehicle_role: v.vehicle_role ?? '',
    sort_order:   v.sort_order,
  }
}
function vehDraftToPatch(d: VehDraft): ElementDriverDetailPatch {
  const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim())
  return {
    driver_name:  orNull(d.driver_name),
    driver_phone: orNull(d.driver_phone),
    car_model:    orNull(d.car_model),
    plate:        orNull(d.plate),
    company:      orNull(d.company),
    vehicle_role: orNull(d.vehicle_role),
    sort_order:   d.sort_order,
  }
}

export function AuxDriverDetailsEditor({ auxBookingId }: { auxBookingId: string }) {
  const [veh,    setVeh]    = useState<ElementDriverDetail[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft,  setDraft]  = useState<VehDraft>(emptyVehDraft(0))
  const [saving, setSaving] = useState(false)
  const { success, error } = useAdminToast()

  useEffect(() => {
    fetchAuxDriverDetails(auxBookingId)
      .then(rows => setVeh(rows.sort((a, b) => a.sort_order - b.sort_order)))
      .catch(() => setVeh([]))
  }, [auxBookingId])

  const sorted = [...(veh ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  function beginAdd() { setEditId(null); setDraft(emptyVehDraft(veh?.length ?? 0)); setAdding(true) }
  function beginEdit(v: ElementDriverDetail) { setAdding(false); setEditId(v.id); setDraft(vehToDraft(v)) }

  async function handleSave() {
    setSaving(true)
    try {
      const patch = vehDraftToPatch(draft)
      if (editId) {
        const updated = await updateAuxDriverDetail(editId, patch)
        setVeh(prev => (prev ?? []).map(v => v.id === editId ? updated : v))
        setEditId(null)
        success('Vehicle updated')
        return
      }
      const created = await createAuxDriverDetail(auxBookingId, patch)
      setVeh(prev => [...(prev ?? []), created])
      setAdding(false)
      success('Vehicle added')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to save vehicle') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await deleteAuxDriverDetail(id)
      setVeh(prev => (prev ?? []).filter(v => v.id !== id))
      success('Vehicle removed')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to delete vehicle') }
    finally { setSaving(false) }
  }

  const form = (
    <div style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <VehField label='Driver Name' value={draft.driver_name} onChange={v => setDraft({ ...draft, driver_name: v })} placeholder='Mr. Schmidt' />
        <VehField label='Driver Phone' value={draft.driver_phone} onChange={v => setDraft({ ...draft, driver_phone: v })} placeholder='+43 ...' />
        <VehField label='Car Model' value={draft.car_model} onChange={v => setDraft({ ...draft, car_model: v })} placeholder='Mercedes V-Class' />
        <VehField label='Plate' value={draft.plate} onChange={v => setDraft({ ...draft, plate: v })} placeholder='S-AB 1234' />
        <VehField label='Vehicle Role' value={draft.vehicle_role} onChange={v => setDraft({ ...draft, vehicle_role: v })} placeholder='Principal / Staff / Luggage' />
        <VehField label='Company (internal)' value={draft.company} onChange={v => setDraft({ ...draft, company: v })} placeholder='Operator name' />
        <VehField label='Sort Order' type='number' value={String(draft.sort_order)} onChange={v => setDraft({ ...draft, sort_order: parseInt(v, 10) || 0 })} />
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
          Driver Details ({veh?.length ?? 0})
        </div>
        {!adding && !editId && (
          <button onClick={beginAdd} style={{ fontFamily: A.font, fontSize: 9, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
            + Vehicle
          </button>
        )}
      </div>

      {sorted.map(v => (
        editId === v.id ? (
          <div key={v.id} style={{ marginBottom: 6 }}>{form}</div>
        ) : (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '4px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: A.text, fontFamily: A.font }}>{v.driver_name || 'Driver'}</span>
              {v.vehicle_role && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginLeft: 8 }}>{v.vehicle_role}</span>}
              <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', marginLeft: 8 }}>
                {[v.driver_phone, v.car_model, v.plate].filter(Boolean).join('  ·  ')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => beginEdit(v)} style={{ fontFamily: A.font, fontSize: 9, color: A.gold, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Edit</button>
              <button onClick={() => handleDelete(v.id)} disabled={saving} style={{ fontFamily: A.font, fontSize: 9, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>×</button>
            </div>
          </div>
        )
      ))}

      {adding && <div style={{ marginTop: 6 }}>{form}</div>}
    </div>
  )
}