/* AirlinePicker.tsx
 * Shared airline-supplier picker. The single source for selecting an airline
 * from the supplier registry (Commercial Airline + Private Jet / Charter
 * types) with inline creation of a new airline if it's not yet registered.
 *
 * Extracted from BriefEditorPage's FlightDetailsSubsection so the dossier
 * AuxForm (EngagementDossierSection) and the brief editor share one implementation —
 * closing the airline supplier parity gap (dossier previously had free-text
 * airline_name only; brief had the supplier picker).
 *
 * Value model: parameterised on value/onChange so each caller wires its own
 * persistence. Dossier saves on form submit; brief saves inline per field.
 * Neither save path lives here.
 *
 * Last updated: S54c — initial extract.
 */

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { fetchSuppliers, createSupplier, type Supplier, type SupplierType } from '../../queries/queriesAdminSuppliers'

// Field-style picker (underline, transparent) — matches the brief editor's
// fieldStyle. Callers that want a boxed style can override via styleVariant.
const fieldStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text,
  background: 'transparent', border: 'none',
  borderBottom: `1px solid ${A.border}`,
  outline: 'none', width: '100%', padding: '2px 0',
  boxSizing: 'border-box' as const,
}

// Boxed style — matches the dossier AuxForm's inputStyle.
const boxedStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text, background: A.bg,
  border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 8px',
  width: '100%', boxSizing: 'border-box' as const, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, marginBottom: 3, display: 'block',
}

export function AirlinePicker({
  supplierId,
  airlineNameFallback = '',
  bookingType,
  variant = 'field',
  showLabel = true,
  onChange,
}: {
  supplierId:           string
  airlineNameFallback?: string   // free-text airline_name, shown as resolved fallback
  bookingType?:         string   // drives default supplier type on inline-create
  variant?:             'field' | 'boxed'
  showLabel?:           boolean
  onChange:             (supplierId: string) => void
}) {
  const [airlines,        setAirlines]        = useState<Supplier[]>([])
  const [airlinesLoading, setAirlinesLoading] = useState(true)
  const [creating,        setCreating]        = useState(false)
  const [newName,         setNewName]         = useState('')

  const style = variant === 'boxed' ? boxedStyle : fieldStyle

  useEffect(() => {
    fetchSuppliers(['airline', 'aviation'])
      .then(rows => setAirlines(rows))
      .catch(() => setAirlines([]))
      .finally(() => setAirlinesLoading(false))
  }, [])

  const selected     = airlines.find(a => a.id === supplierId) ?? null
  const resolvedName = selected?.name ?? airlineNameFallback

  function handleChange(value: string) {
    if (value === '__create__') { setCreating(true); return }
    onChange(value)
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) { setCreating(false); return }
    try {
      const supplierType: SupplierType = bookingType === 'private_jet'
        ? 'aviation'
        : 'airline'
      const created = await createSupplier(name, supplierType)
      setAirlines(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      onChange(created.id)
      setNewName('')
      setCreating(false)
    } catch {
      // Silent — leave create form open for retry.
    }
  }

  return (
    <div>
      {showLabel && <label style={labelStyle}>Airline</label>}
      {creating ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            autoFocus
            style={{ ...style, flex: 1 }}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            placeholder='New airline name'
          />
          <button onClick={handleCreate}
            style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
            Create
          </button>
          <button onClick={() => { setCreating(false); setNewName('') }}
            style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            Cancel
          </button>
        </div>
      ) : (
        <select
          style={{ ...style, cursor: airlinesLoading ? 'wait' : 'pointer' }}
          value={supplierId}
          onChange={e => handleChange(e.target.value)}
          disabled={airlinesLoading}
        >
          <option value=''>{airlinesLoading ? 'Loading\u2026' : '\u2014 Select airline \u2014'}</option>
          {airlines.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value='__create__'>+ Add new airline\u2026</option>
        </select>
      )}
      {resolvedName && !creating && (
        <div style={{ fontSize: 9, color: A.faint, fontFamily: A.font, marginTop: 3, fontStyle: 'italic' }}>
          Confirmed: {resolvedName}
        </div>
      )}
    </div>
  )
}