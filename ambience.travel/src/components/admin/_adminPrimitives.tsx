/* _adminPrimitives.tsx
 * Phase 2 admin UI primitives for AmbienceAdmin.
 *
 * What it owns:
 *   AdminCard       -- panel with lift hover + optional stagger delay
 *   AdminSection    -- 2px gold left bar + tracked caps title
 *   StatusPill      -- colour-coded engagement status chip with floating picker
 *   AdminModal      -- header zone, scrolling body, sticky save bar
 *   AdminToast      -- self-contained admin toast (slides up, progress bar, left border)
 *   AdminEmptyState -- centred icon, copy, optional CTA
 *
 * What it does not own:
 *   Field, SectionLabel, CopyButton -- remain in adminUi.tsx
 *   Cross-product toast -- Toast.tsx + ToastContext, mounted in main.tsx
 *   Keyframes -- live in animations.ts APP_STYLES (injected via injectAppStyles)
 *
 * Motion: all transitions use cubic-bezier(0.16,1,0.3,1) per spec.
 *
 * Last updated: S43 -- new file, Phase 2 admin redesign.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { A } from '../../tokens/tokensAdmin'
import type { EngagementStatusSlug } from '../../types/typesImmerse'

const EASE = 'cubic-bezier(0.16,1,0.3,1)'

// ─── AdminCard ────────────────────────────────────────────────────────────────
// Panel with lift hover + optional stagger entrance delay.
// staggerIndex: 0-based position in list. Delay capped at 8 items (320ms max).

export function AdminCard({
  children,
  staggerIndex,
  style,
  onClick,
}: {
  children:      ReactNode
  staggerIndex?: number
  style?:        CSSProperties
  onClick?:      () => void
}) {
  const [hovered, setHovered] = useState(false)

  const delay = staggerIndex !== undefined
    ? Math.min(staggerIndex, 8) * 40
    : 0

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    A.bgCard,
        border:        `1px solid ${hovered ? 'rgba(216,181,106,0.3)' : A.border}`,
        borderRadius:  14,
        padding:       20,
        cursor:        onClick ? 'pointer' : 'default',
        transform:     hovered && onClick ? 'translateY(-2px)' : 'translateY(0)',
        transition:    `transform 150ms ${EASE}, border-color 150ms ${EASE}, box-shadow 150ms ${EASE}`,
        boxShadow:     hovered && onClick ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
        animation:     delay > 0 ? `_a_admin_card_in 300ms ${EASE} ${delay}ms both` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── AdminSection ─────────────────────────────────────────────────────────────
// 2px gold left bar + 9pt tracked gold caps title. Optional muted subtitle line.
// Wraps a content block.

export function AdminSection({
  title,
  subtitle,
  children,
  style,
}: {
  title?:    string
  subtitle?: string
  children?: ReactNode
  style?:    CSSProperties
}) {
  return (
    <div style={{
      borderLeft: `2px solid rgba(216,181,106,0.3)`,
      paddingLeft: 12,
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color:         A.gold,
          fontFamily:    A.font,
          marginBottom:  subtitle ? 4 : 10,
        }}>
          {title}
        </div>
      )}
      {subtitle && (
        <div style={{
          fontSize:     12,
          color:        A.muted,
          fontFamily:   A.font,
          marginBottom: 10,
        }}>
          {subtitle}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
// Colour-coded chip. Click opens a floating option list (no select element).
// Optimistic update: colour changes immediately, reverts on server error.

type StatusOption = {
  slug:  EngagementStatusSlug
  label: string
}

const STATUS_CONFIG: Record<EngagementStatusSlug, { bg: string; color: string; border: string }> = {
  requested:    { bg: 'rgba(127,222,255,0.08)', color: '#7FDEFF',  border: 'rgba(127,222,255,0.2)'  },
  quoted:       { bg: 'rgba(232,197,71,0.10)',  color: '#E8C547',  border: 'rgba(232,197,71,0.25)'  },
  pending:      { bg: 'rgba(216,181,106,0.10)', color: '#D8B56A',  border: 'rgba(216,181,106,0.3)'  },
  confirmed:    { bg: 'rgba(74,222,128,0.10)',  color: '#4ade80',  border: 'rgba(74,222,128,0.25)'  },
  paid:         { bg: 'rgba(74,222,128,0.14)',  color: '#4ade80',  border: 'rgba(74,222,128,0.3)'   },
  in_service:   { bg: 'rgba(45,212,191,0.10)',  color: '#2dd4bf',  border: 'rgba(45,212,191,0.25)'  },
  closed_won:   { bg: 'rgba(74,222,128,0.06)',  color: '#86efac',  border: 'rgba(74,222,128,0.15)'  },
  cancelled:    { bg: 'rgba(248,113,113,0.10)', color: '#f87171',  border: 'rgba(248,113,113,0.25)' },
  closed_lost:  { bg: 'rgba(248,113,113,0.06)', color: '#fca5a5',  border: 'rgba(248,113,113,0.15)' },
}

export function StatusPill({
  slug,
  label,
  options,
  onSelect,
}: {
  slug:     EngagementStatusSlug
  label:    string
  options?: StatusOption[]
  onSelect?: (slug: EngagementStatusSlug) => Promise<void>
}) {
  const [open,        setOpen]        = useState(false)
  const [optimistic,  setOptimistic]  = useState<EngagementStatusSlug>(slug)
  const ref = useRef<HTMLDivElement>(null)

  // Sync if parent slug changes (e.g. after server confirm)
  useEffect(() => { setOptimistic(slug) }, [slug])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleSelect(next: EngagementStatusSlug) {
    setOpen(false)
    if (!onSelect) return
    const prev = optimistic
    setOptimistic(next)
    try {
      await onSelect(next)
    } catch {
      setOptimistic(prev)
    }
  }

  const cfg = STATUS_CONFIG[optimistic] ?? STATUS_CONFIG.requested

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => options && onSelect && setOpen(o => !o)}
        style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           5,
          padding:       '3px 10px',
          borderRadius:  20,
          background:    cfg.bg,
          border:        `1px solid ${cfg.border}`,
          color:         cfg.color,
          fontSize:      11,
          fontWeight:    600,
          fontFamily:    A.font,
          letterSpacing: '0.02em',
          cursor:        options && onSelect ? 'pointer' : 'default',
          transition:    `background 150ms ${EASE}, color 150ms ${EASE}, border-color 150ms ${EASE}`,
          whiteSpace:    'nowrap',
        }}
      >
        {label}
        {options && onSelect && (
          <svg width={8} height={8} viewBox='0 0 8 8' fill='none'>
            <path d='M1 2.5 L4 5.5 L7 2.5' stroke={cfg.color} strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        )}
      </button>

      {open && options && (
        <div style={{
          position:     'absolute',
          top:          'calc(100% + 6px)',
          left:         0,
          zIndex:       200,
          background:   A.bgCard,
          border:       `1px solid ${A.border}`,
          borderRadius: 10,
          overflow:     'hidden',
          minWidth:     180,
          boxShadow:    '0 8px 32px rgba(0,0,0,0.4)',
          animation:    `_a_admin_status_pill_in 150ms ${EASE} both`,
        }}>
          {options.map(opt => {
            const oc = STATUS_CONFIG[opt.slug] ?? STATUS_CONFIG.requested
            return (
              <button
                key={opt.slug}
                onClick={() => handleSelect(opt.slug)}
                style={{
                  display:    'block',
                  width:      '100%',
                  padding:    '8px 14px',
                  background: opt.slug === optimistic ? 'rgba(216,181,106,0.06)' : 'transparent',
                  border:     'none',
                  borderBottom: `1px solid ${A.border}`,
                  color:      oc.color,
                  fontSize:   12,
                  fontFamily: A.font,
                  fontWeight: opt.slug === optimistic ? 600 : 400,
                  textAlign:  'left',
                  cursor:     'pointer',
                  transition: `background 120ms ease`,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(216,181,106,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = opt.slug === optimistic ? 'rgba(216,181,106,0.06)' : 'transparent')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── AdminModal ───────────────────────────────────────────────────────────────
// Overlay + modal panel. Header zone distinct (bgPanel2), body scrolls
// independently, save bar sticky at bottom.

export function AdminModal({
  title,
  onClose,
  onSave,
  saving,
  saveLabel = 'Save',
  children,
  width = 600,
}: {
  title:      string
  onClose:    () => void
  onSave?:    () => void
  saving?:    boolean
  saveLabel?: string
  children:   ReactNode
  width?:     number
}) {
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1000,
        background:     'rgba(0,0,0,0.7)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        animation:      `_a_overlay_in 200ms ease both`,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:         '100%',
          maxWidth:      width,
          maxHeight:     '88vh',
          display:       'flex',
          flexDirection: 'column',
          background:    A.bgCard,
          border:        `1px solid ${A.border}`,
          borderRadius:  16,
          overflow:      'hidden',
          animation:     `_a_admin_modal_in 200ms ${EASE} both`,
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '18px 24px',
          background:     A.bgInput,
          borderBottom:   `1px solid ${A.border}`,
          flexShrink:     0,
        }}>
          <span style={{
            fontSize:   20,
            fontWeight: 600,
            color:      A.text,
            fontFamily: A.font,
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background:   'transparent',
              border:       'none',
              color:        A.muted,
              cursor:       'pointer',
              fontSize:     18,
              lineHeight:   1,
              padding:      '4px 8px',
              borderRadius: 6,
              fontFamily:   A.font,
              transition:   'color 120ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = A.text)}
            onMouseLeave={e => (e.currentTarget.style.color = A.muted)}
            aria-label='Close'
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex:       1,
          overflowY:  'auto',
          padding:    '24px',
        }}>
          {children}
        </div>

        {/* Sticky save bar */}
        {onSave && (
          <div style={{
            display:        'flex',
            justifyContent: 'flex-end',
            gap:            10,
            padding:        '14px 24px',
            borderTop:      `1px solid ${A.border}`,
            background:     A.bgCard,
            flexShrink:     0,
          }}>
            <button
              onClick={onClose}
              style={{
                padding:      '8px 18px',
                background:   'transparent',
                border:       `1px solid ${A.border}`,
                borderRadius: 8,
                color:        A.muted,
                fontSize:     13,
                fontFamily:   A.font,
                cursor:       'pointer',
                transition:   'border-color 120ms ease, color 120ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = A.gold
                e.currentTarget.style.color = A.gold
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = A.border
                e.currentTarget.style.color = A.muted
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                padding:      '8px 20px',
                background:   saving ? 'rgba(216,181,106,0.4)' : A.gold,
                border:       'none',
                borderRadius: 8,
                color:        saving ? 'rgba(0,0,0,0.5)' : '#0a0a0a',
                fontSize:     13,
                fontWeight:   600,
                fontFamily:   A.font,
                cursor:       saving ? 'default' : 'pointer',
                transition:   `background 150ms ${EASE}`,
              }}
            >
              {saving ? 'Saving...' : saveLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AdminToast ───────────────────────────────────────────────────────────────
// Self-contained admin toast stack. Slides up from bottom-right, 220ms ease-out.
// Progress bar on bottom edge. Auto-dismiss 4s. Left border: green=success, red=error.
// Mount <AdminToastContainer /> once in AmbienceAdmin.tsx (or its root wrapper).
// Use the useAdminToast() hook anywhere beneath it.

type AdminToastVariant = 'success' | 'error'

type AdminToastItem = {
  id:       string
  variant:  AdminToastVariant
  message:  string
  exiting:  boolean
}

type AdminToastContextValue = {
  success: (msg: string) => void
  error:   (msg: string) => void
}

import { createContext, useContext } from 'react'

const AdminToastContext = createContext<AdminToastContextValue | null>(null)

export function useAdminToast(): AdminToastContextValue {
  const ctx = useContext(AdminToastContext)
  if (!ctx) throw new Error('useAdminToast must be used within AdminToastProvider')
  return ctx
}

const ADMIN_TOAST_DURATION = 4000
const ADMIN_TOAST_EXIT     = 200

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AdminToastItem[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    timers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete timers.current[id]
    }, ADMIN_TOAST_EXIT)
  }, [])

  const add = useCallback((variant: AdminToastVariant, message: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => {
      const capped = prev.length >= 4 ? prev.slice(1) : prev
      return [...capped, { id, variant, message, exiting: false }]
    })
    timers.current[id] = setTimeout(() => dismiss(id), ADMIN_TOAST_DURATION)
  }, [dismiss])

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout) }, [])

  const value: AdminToastContextValue = {
    success: (msg) => add('success', msg),
    error:   (msg) => add('error',   msg),
  }

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <AdminToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminToastContext.Provider>
  )
}

function AdminToastContainer({
  toasts,
  onDismiss,
}: {
  toasts:    AdminToastItem[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div style={{
      position:      'fixed',
      bottom:        24,
      right:         24,
      zIndex:        9000,
      display:       'flex',
      flexDirection: 'column',
      gap:           8,
      alignItems:    'flex-end',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <AdminToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function AdminToastItem({
  toast: t,
  onDismiss,
}: {
  toast:     AdminToastItem
  onDismiss: (id: string) => void
}) {
  const isSuccess = t.variant === 'success'
  const accentColor = isSuccess ? '#4ade80' : '#f87171'

  return (
    <div
      style={{
        pointerEvents:  'all',
        position:       'relative',
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        padding:        '11px 14px',
        paddingLeft:    16,
        borderRadius:   10,
        background:     A.bgCard,
        border:         `1px solid ${A.border}`,
        borderLeft:     `3px solid ${accentColor}`,
        minWidth:       240,
        maxWidth:       360,
        boxShadow:      '0 4px 24px rgba(0,0,0,0.5)',
        fontFamily:     A.font,
        animation:      t.exiting
          ? `_a_admin_toast_out ${ADMIN_TOAST_EXIT}ms ${EASE} both`
          : `_a_admin_toast_in 220ms ${EASE} both`,
        overflow:       'hidden',
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 13, color: accentColor, flexShrink: 0, lineHeight: 1 }}>
        {isSuccess ? '✓' : '✕'}
      </span>

      {/* Message */}
      <span style={{
        flex:       1,
        fontSize:   12,
        fontWeight: 500,
        color:      A.text,
        lineHeight: 1.4,
      }}>
        {t.message}
      </span>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(t.id)}
        style={{
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          color:      A.faint,
          fontSize:   12,
          fontFamily: A.font,
          padding:    '0 0 0 8px',
          flexShrink: 0,
          transition: 'color 120ms ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = A.muted)}
        onMouseLeave={e => (e.currentTarget.style.color = A.faint)}
        aria-label='Dismiss'
      >
        ✕
      </button>

      {/* Progress bar */}
      <div style={{
        position:   'absolute',
        bottom:     0,
        left:       0,
        height:     2,
        background: accentColor,
        opacity:    0.5,
        animation:  `toast-progress ${ADMIN_TOAST_DURATION}ms linear forwards`,
        width:      '100%',
      }} />
    </div>
  )
}

// ─── AdminEmptyState ──────────────────────────────────────────────────────────
// Centred SVG icon, single line copy, optional CTA button.

export function AdminEmptyState({
  icon,
  message,
  ctaLabel,
  onCta,
}: {
  icon?:     ReactNode
  message:   string
  ctaLabel?: string
  onCta?:    () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            14,
      padding:        '48px 24px',
      color:          A.faint,
      fontFamily:     A.font,
    }}>
      {icon && (
        <div style={{ opacity: 0.4 }}>
          {icon}
        </div>
      )}
      <span style={{ fontSize: 13, color: A.muted, textAlign: 'center', maxWidth: 280 }}>
        {message}
      </span>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            padding:      '7px 18px',
            background:   'transparent',
            border:       `1px solid ${hovered ? A.gold : A.border}`,
            borderRadius: 8,
            color:        hovered ? A.gold : A.muted,
            fontSize:     12,
            fontFamily:   A.font,
            cursor:       'pointer',
            transition:   `border-color 150ms ${EASE}, color 150ms ${EASE}`,
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}