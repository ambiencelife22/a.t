// SettingsTab.tsx — Studio > Settings.
//
// Platform-level settings for AmbienceAdmin. Currently owns:
//   - Maintenance mode toggle (a_platform_settings.maintenance_mode)
//
// Read:  travel-read-settings EF (admin JWT)
// Write: travel-write-settings EF (admin JWT)
//
// Toggle is optimistic — UI updates immediately, reverts on error.
// Shows last-changed-by (user ID) and timestamp when available.
//
// Created: S53H

import { useState, useEffect } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { AdminSection, useAdminToast } from './_adminPrimitives'
import { fetchSettings, setMaintenanceMode, type PlatformSettings } from '../../queries/queriesSettings'
import { formatDateShort } from '../../utils/utilsDates'

const EASE = 'cubic-bezier(0.16,1,0.3,1)'

export default function SettingsTab() {
  const toast = useAdminToast()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load settings.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle() {
    if (!settings || saving) return
    const next = !settings.maintenance_mode

    // Optimistic
    setSettings(s => s ? { ...s, maintenance_mode: next } : s)
    setSaving(true)

    try {
      const updated = await setMaintenanceMode(next)
      setSettings(updated)
      toast.success(next ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.')
    } catch {
      // Revert
      setSettings(s => s ? { ...s, maintenance_mode: !next } : s)
      toast.error('Failed to update maintenance mode.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      padding:   '32px 28px',
      maxWidth:  720,
      fontFamily: A.font,
    }}>
      <div style={{
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color:         A.gold,
        fontFamily:    A.font,
        marginBottom:  24,
      }}>
        Platform Settings
      </div>

      <AdminSection title='Maintenance Mode'>
        <div style={{
          marginTop:     12,
          background:    A.bgCard,
          border:        `1px solid ${A.border}`,
          borderRadius:  12,
          padding:       '20px 20px',
        }}>
          {/* Toggle row */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            16,
          }}>
            <div>
              <div style={{
                fontSize:   13,
                fontWeight: 600,
                color:      A.text,
                fontFamily: A.font,
                marginBottom: 4,
              }}>
                Maintenance screen
              </div>
              <div style={{
                fontSize:   12,
                color:      A.muted,
                fontFamily: A.font,
                lineHeight: 1.6,
                maxWidth:   400,
              }}>
                When on, all public surfaces (immerse, guides, landing) show a
                maintenance screen. Admin routes are unaffected.
              </div>
            </div>

            {/* Toggle switch */}
            <button
              onClick={handleToggle}
              disabled={loading || saving}
              aria-label={settings?.maintenance_mode ? 'Disable maintenance mode' : 'Enable maintenance mode'}
              style={{
                flexShrink:   0,
                position:     'relative',
                width:        48,
                height:       26,
                borderRadius: 13,
                border:       'none',
                background:   loading
                  ? A.bgInput
                  : settings?.maintenance_mode
                    ? '#ef4444'
                    : A.bgInput,
                cursor:       loading || saving ? 'default' : 'pointer',
                transition:   `background 200ms ${EASE}`,
                opacity:      saving ? 0.7 : 1,
              }}
            >
              <span style={{
                position:     'absolute',
                top:          3,
                left:         settings?.maintenance_mode ? 25 : 3,
                width:        20,
                height:       20,
                borderRadius: '50%',
                background:   '#fff',
                transition:   `left 200ms ${EASE}`,
                boxShadow:    '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* Last updated */}
          {settings?.updated_at && (
            <div style={{
              marginTop:  16,
              paddingTop: 14,
              borderTop:  `1px solid ${A.border}`,
              fontSize:   11,
              color:      A.faint,
              fontFamily: A.font,
              display:    'flex',
              gap:        12,
            }}>
              <span>
                Last changed {formatDateShort(settings.updated_at)}
              </span>
              {settings.updated_by && (
                <span style={{ color: A.muted, fontFamily: 'monospace', fontSize: 10 }}>
                  {settings.updated_by.slice(0, 8)}
                </span>
              )}
            </div>
          )}

          {/* Live state pill */}
          {!loading && settings && (
            <div style={{
              marginTop:  12,
              display:    'inline-flex',
              alignItems: 'center',
              gap:        6,
              padding:    '3px 10px',
              borderRadius: 20,
              background: settings.maintenance_mode
                ? 'rgba(239,68,68,0.10)'
                : 'rgba(74,222,128,0.08)',
              border: `1px solid ${settings.maintenance_mode
                ? 'rgba(239,68,68,0.25)'
                : 'rgba(74,222,128,0.2)'}`,
              fontSize:   11,
              fontWeight: 600,
              color:      settings.maintenance_mode ? '#f87171' : '#4ade80',
              fontFamily: A.font,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: settings.maintenance_mode ? '#ef4444' : '#4ade80',
                flexShrink: 0,
              }} />
              {settings.maintenance_mode ? 'Maintenance active' : 'Live'}
            </div>
          )}
        </div>
      </AdminSection>
    </div>
  )
}