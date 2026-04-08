/* Toast.tsx
 * ToastProvider  — wraps the app, manages toast state
 * ToastContainer — fixed overlay that renders the toast stack
 *
 * Keyframes live in animations.ts (injected once via injectAppStyles).
 * Palette colours read from C.* — dark/light reactive.
 */

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastVariant } from '../lib/ToastContext'
import { C } from '../lib/theme'
import { useContext } from 'react'
import { ThemeContext } from '../lib/ThemeContext'

// ── Default durations (ms) ────────────────────────────────────────────────────

const DEFAULTS: Record<ToastVariant, number> = {
  success: 3500,
  error:   6000,   // errors stay longer — user needs time to read
  warning: 5000,
  info:    4000,
}

const EXIT_DURATION = 180  // must match _a_toast_out in animations.ts

// ── ToastProvider ─────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    // Mark as exiting — triggers exit animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    // Remove after animation completes
    timers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete timers.current[id]
    }, EXIT_DURATION)
  }, [])

  const add = useCallback((variant: ToastVariant, message: string, duration?: number) => {
    const id       = crypto.randomUUID()
    const dur      = duration ?? DEFAULTS[variant]
    const newToast: Toast = { id, variant, message, duration: dur, exiting: false }

    setToasts(prev => {
      // Cap queue at 5 — dismiss oldest if needed
      const capped = prev.length >= 5 ? prev.slice(1) : prev
      return [...capped, newToast]
    })

    if (dur > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), dur)
    }
    return id
  }, [dismiss])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => { Object.values(timers.current).forEach(clearTimeout) }
  }, [])

const toast = {
  success: (msg: string, dur?: number) => add('success', msg, dur),
  error:   (msg: string, dur?: number) => add('error',   msg, dur),
  warning: (msg: string, dur?: number) => add('warning', msg, dur),
  info:    (msg: string, dur?: number) => add('info',    msg, dur),
  dismiss,
}

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
    </ToastContext.Provider>
  )
}

// ── ToastContainer ────────────────────────────────────────────────────────────
// Render this once in App.tsx, outside Layout, alongside TutorialModal.

export function ToastContainer() {
  const { toasts, toast } = useContext(ToastContext)
  const { isDark }        = useContext(ThemeContext)

  if (toasts.length === 0) return null

  return (
    <div style={{
      position:      'fixed',
      bottom:        '24px',
      right:         '24px',
      zIndex:        9999,
      display:       'flex',
      flexDirection: 'column',
      gap:           '8px',
      alignItems:    'flex-end',
      pointerEvents: 'none',   // container doesn't block clicks
    }}>
      {toasts.map(t => (
        <ToastItem
          key={t.id}
          toast={t}
          isDark={isDark}
          onDismiss={() => toast.dismiss(t.id)}
        />
      ))}
    </div>
  )
}

// ── ToastItem ─────────────────────────────────────────────────────────────────

interface ToastItemProps {
  toast:     Toast
  isDark:    boolean
  onDismiss: () => void
}

function ToastItem({ toast: t, isDark, onDismiss }: ToastItemProps) {
  const config = VARIANT_CONFIG[t.variant]

  const bg     = isDark ? config.bgDark     : config.bgLight
  const border = isDark ? config.borderDark : config.borderLight
  const icon   = config.icon
  const color  = isDark ? config.colorDark  : config.colorLight

  return (
    <div
      className={t.exiting ? '_a_toast_out' : '_a_toast_in'}
      style={{
        pointerEvents:   'all',
        position:        'relative',
        display:         'flex',
        alignItems:      'flex-start',
        gap:             '10px',
        padding:         '12px 14px',
        borderRadius:    '10px',
        background:      bg,
        border:          `1px solid ${border}`,
        minWidth:        '260px',
        maxWidth:        '380px',
        boxShadow:       isDark
          ? '0 4px 24px rgba(0,0,0,0.4)'
          : '0 4px 24px rgba(0,0,0,0.10)',
        fontFamily:      "'Plus Jakarta Sans', sans-serif",
        cursor:          'default',
      }}
    >
      {/* Icon */}
      <span style={{
        fontSize:   '14px',
        lineHeight: '20px',
        flexShrink: 0,
        color,
      }}>
        {icon}
      </span>

      {/* Message */}
      <span style={{
        flex:       1,
        fontSize:   '13px',
        lineHeight: '1.5',
        color:      isDark ? C.text : C.text,
        fontWeight: 500,
        paddingTop: '1px',
      }}>
        {t.message}
      </span>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        style={{
          background:  'none',
          border:      'none',
          cursor:      'pointer',
          padding:     '0 0 0 4px',
          lineHeight:  '20px',
          fontSize:    '14px',
          color:       C.faint,
          flexShrink:  0,
          fontFamily:  "'Plus Jakarta Sans', sans-serif",
          transition:  'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = C.muted)}
        onMouseLeave={e => (e.currentTarget.style.color = C.faint)}
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Progress bar — only for auto-dismissing toasts */}
      {t.duration > 0 && (
        <div style={{
          position:     'absolute',
          bottom:       0,
          left:         0,
          height:       '2px',
          borderRadius: '0 0 10px 10px',
          background:   color,
          opacity:      0.4,
          animation:    `toast-progress ${t.duration}ms linear forwards`,
          width:        '100%',
        }} />
      )}
    </div>
  )
}

// ── Variant config ────────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
  icon:        string
  bgDark:      string
  bgLight:     string
  borderDark:  string
  borderLight: string
  colorDark:   string
  colorLight:  string
}> = {
  success: {
    icon:        '✓',
    bgDark:      'rgba(34,38,34,0.97)',
    bgLight:     'rgba(255,255,255,0.98)',
    borderDark:  'rgba(74,222,128,0.25)',
    borderLight: 'rgba(26,122,63,0.25)',
    colorDark:   '#4ade80',
    colorLight:  '#1A7A3F',
  },
  error: {
    icon:        '✕',
    bgDark:      'rgba(34,38,34,0.97)',
    bgLight:     'rgba(255,255,255,0.98)',
    borderDark:  'rgba(248,113,113,0.25)',
    borderLight: 'rgba(192,57,43,0.25)',
    colorDark:   '#f87171',
    colorLight:  '#C0392B',
  },
  warning: {
    icon:        '⚠',
    bgDark:      'rgba(34,38,34,0.97)',
    bgLight:     'rgba(255,255,255,0.98)',
    borderDark:  'rgba(232,197,71,0.25)',
    borderLight: 'rgba(184,150,12,0.30)',
    colorDark:   '#E8C547',
    colorLight:  '#B8960C',
  },
  info: {
    icon:        'ℹ',
    bgDark:      'rgba(34,38,34,0.97)',
    bgLight:     'rgba(255,255,255,0.98)',
    borderDark:  'rgba(127,222,255,0.20)',
    borderLight: 'rgba(10,126,164,0.20)',
    colorDark:   '#7FDEFF',
    colorLight:  '#0A7EA4',
  },
}