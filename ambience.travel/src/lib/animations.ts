// animations.ts — canonical animation registry for the entire ambience repo
// What it owns:
//   - CSS keyframe injection for SPORTS (injectAppStyles)
//   - ANIM + DURATION constants (SPORTS class-based animations)
//   - useCardTransition hook (SPORTS paginated content)
//   - useAnimatedNumber hook (SPORTS number count-up)
//   - useVisible hook (TRAVEL intersection-based fade triggers)
//   - fadeUp() helper (TRAVEL inline style fade-up transitions)
//   - useScrollParallax hook (TRAVEL subtle image parallax)
//   - useScrollProgress hook (TRAVEL scroll-linked animation driver)
//
// What it does not own:
//   - Immerse keyframes — these live in src/index.css (hoisted S31).
//     Do not duplicate immerseGoldBreatheSolid, immerseFadeIn, etc. here.
//   - Token values — all colours come from lib/landingColors or lib/colors.
//   - Component-level animation logic (hover states, transition props).
//
// Last updated: S40 — Created. Merged SPORTS animations.ts + TRAVEL inline
//   animation primitives (useVisible, fadeUp, useScrollParallax,
//   useScrollProgress from ImmerseComponents). Single source of truth
//   for all animation hooks and constants across the repo.
//
// Adding new animations:
//   - New CSS keyframes for immerse layer → src/index.css, reference by name here
//   - New CSS keyframes for SPORTS layer → APP_STYLES string below
//   - New hooks → add to the relevant section below with a // ── comment header
//   - New ANIM constants → add to the ANIM object with a comment grouping
//   - Tag additions with session number in a comment: // Added S4N

import { useState, useEffect, useRef } from 'react'
import type React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// § SPORTS — CSS keyframe injection
// These keyframes are injected at runtime via injectAppStyles(), called once
// in App.tsx on mount. They are SPORTS-specific; immerse keyframes live in
// src/index.css and are always available globally.
// ─────────────────────────────────────────────────────────────────────────────

const APP_STYLES = `
/* ── Card transitions (paginated content) ── */
@keyframes _a_card_in_fwd {
  from { opacity: 0; transform: translateX(14px); }
  to   { opacity: 1; transform: translateX(0);    }
}
@keyframes _a_card_in_back {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: translateX(0);     }
}
@keyframes _a_card_out_fwd {
  from { opacity: 1; transform: translateX(0);     }
  to   { opacity: 0; transform: translateX(-14px); }
}
@keyframes _a_card_out_back {
  from { opacity: 1; transform: translateX(0);    }
  to   { opacity: 0; transform: translateX(14px); }
}
._a_card_in_fwd  { animation: _a_card_in_fwd   220ms cubic-bezier(0.25, 0, 0.1, 1) both; }
._a_card_in_back { animation: _a_card_in_back  220ms cubic-bezier(0.25, 0, 0.1, 1) both; }
._a_card_out_fwd { animation: _a_card_out_fwd  160ms cubic-bezier(0.4, 0, 1, 1)    both; }
._a_card_out_back{ animation: _a_card_out_back 160ms cubic-bezier(0.4, 0, 1, 1)    both; }

/* ── Modal entrance ── */
@keyframes _a_modal_in {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes _a_overlay_in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
._a_modal_in   { animation: _a_modal_in   220ms cubic-bezier(0.25, 0, 0.1, 1) both; }
._a_overlay_in { animation: _a_overlay_in 300ms ease both; }

/* ── Fade in (with subtle lift) ── */
@keyframes _a_fade_in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0);   }
}
._a_fade_in { animation: _a_fade_in 250ms cubic-bezier(0.25, 0, 0.1, 1) both; }

/* ── Tab underline slide ── */
._a_tab_line {
  transition: left 200ms ease-in-out, width 200ms ease-in-out;
}

/* ── Skeleton shimmer loader ── */
@keyframes _a_shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
._a_shimmer {
  background: linear-gradient(90deg, var(--sk-base, rgba(255,255,255,0.04)) 25%, var(--sk-shine, rgba(255,255,255,0.09)) 50%, var(--sk-base, rgba(255,255,255,0.04)) 75%);
  background-size: 800px 100%;
  animation: _a_shimmer 1.4s ease-in-out infinite;
}

/* ── Card stagger fade-in ── */
@keyframes _a_stagger_card {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0);    }
}
._a_stagger_card {
  animation: _a_stagger_card 320ms cubic-bezier(0.25, 0, 0.1, 1) both;
}

/* ── P&L flash on settlement ── */
@keyframes _a_pl_flash_win {
  0%   { background: transparent; }
  20%  { background: rgba(74,222,128,0.18); }
  100% { background: transparent; }
}
@keyframes _a_pl_flash_loss {
  0%   { background: transparent; }
  20%  { background: rgba(248,113,113,0.15); }
  100% { background: transparent; }
}
._a_pl_flash_win  { animation: _a_pl_flash_win  500ms ease-out both; }
._a_pl_flash_loss { animation: _a_pl_flash_loss 500ms ease-out both; }

/* ── Bankroll pulse ── */
@keyframes _a_bankroll_pulse {
  0%   { transform: scale(1);    color: var(--pulse-color, #E8C547); }
  30%  { transform: scale(1.04); color: var(--pulse-color, #E8C547); }
  70%  { transform: scale(1.02); }
  100% { transform: scale(1); }
}
._a_bankroll_pulse { animation: _a_bankroll_pulse 550ms cubic-bezier(0.25, 0, 0.1, 1) both; }

/* ── Button press scale ── */
._a_btn_press {
  transition: transform 100ms ease, opacity 100ms ease;
  transform-origin: center;
}
._a_btn_press:active {
  transform: scale(0.97);
  opacity: 0.88;
}

/* ── Pill tab active background slide ── */
._a_pill_tab {
  transition: background 240ms ease, color 240ms ease, border-color 240ms ease;
}

/* ── Toast notifications ── */
@keyframes _a_toast_in {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
@keyframes _a_toast_out {
  from { opacity: 1; transform: translateY(0)    scale(1);    }
  to   { opacity: 0; transform: translateY(8px)  scale(0.97); }
}
._a_toast_in  { animation: _a_toast_in  220ms cubic-bezier(0.25, 0, 0.1, 1) both; }
._a_toast_out { animation: _a_toast_out 180ms cubic-bezier(0.4, 0, 1, 1)    both; }

/* Toast progress bar */
@keyframes toast-progress {
  from { width: 100%; }
  to   { width: 0%;   }
}

/* ── Loading screen ── */
@keyframes _a_load_pulse {
  0%, 100% { opacity: 1;    transform: scale(1);    }
  50%       { opacity: 0.55; transform: scale(0.93); }
}
@keyframes _a_load_dot {
  0%, 80%, 100% { transform: scale(0); opacity: 0; }
  40%           { transform: scale(1); opacity: 1; }
}
@keyframes _a_load_fade_out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
._a_load_pulse    { animation: _a_load_pulse    1.6s ease-in-out infinite; }
._a_load_fade_out { animation: _a_load_fade_out 300ms ease forwards; }

/* Emblem entry flash — sharp hit then settle into pulse */
@keyframes _a_load_flash {
  0%   { opacity: 0;    transform: scale(0.82); }
  18%  { opacity: 1;    transform: scale(1.12); filter: brightness(1.6); }
  38%  { opacity: 0.92; transform: scale(0.97); filter: brightness(1.0); }
  55%  { opacity: 1;    transform: scale(1.03); }
  70%  { opacity: 0.88; transform: scale(0.98); }
  100% { opacity: 1;    transform: scale(1);    }
}
._a_load_flash { animation: _a_load_flash 700ms cubic-bezier(0.25, 0, 0.1, 1) both; }
`

let _injected = false

export function injectAppStyles(): void {
  if (_injected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.id = 'ambience-app-styles'
  el.textContent = APP_STYLES
  document.head.appendChild(el)
  _injected = true
}

// ─────────────────────────────────────────────────────────────────────────────
// § SPORTS — Animation class name constants
// Apply as className values. Requires injectAppStyles() to have run.
// ─────────────────────────────────────────────────────────────────────────────

export const ANIM = {
  // Card transitions
  cardInFwd:     '_a_card_in_fwd'    as const,
  cardInBack:    '_a_card_in_back'   as const,
  cardOutFwd:    '_a_card_out_fwd'   as const,
  cardOutBack:   '_a_card_out_back'  as const,

  // Modal
  modalIn:       '_a_modal_in'       as const,
  overlayIn:     '_a_overlay_in'     as const,

  // General
  fadeIn:        '_a_fade_in'        as const,

  // Tab
  tabLine:       '_a_tab_line'       as const,
  pillTab:       '_a_pill_tab'       as const,

  // Skeleton
  shimmer:       '_a_shimmer'        as const,

  // Card stagger
  staggerCard:   '_a_stagger_card'   as const,

  // P&L flash
  plFlashWin:    '_a_pl_flash_win'   as const,
  plFlashLoss:   '_a_pl_flash_loss'  as const,

  // Bankroll pulse
  bankrollPulse: '_a_bankroll_pulse' as const,

  // Button press
  btnPress:      '_a_btn_press'      as const,

  // Toast
  toastIn:       '_a_toast_in'       as const,
  toastOut:      '_a_toast_out'      as const,

  // Loading screen
  loadPulse:     '_a_load_pulse'     as const,
  loadFlash:     '_a_load_flash'     as const,
  loadFadeOut:   '_a_load_fade_out'  as const,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// § SPORTS — Timing constants (ms)
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = {
  cardExit:    160,
  cardEnter:   220,
  modalEnter:  220,
  fadeIn:      200,
  toastExit:   180,
  toastEnter:  220,
  loadFadeOut: 300,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// § SPORTS — useCardTransition
// Drives paginated content transitions with direction awareness.
//
// Usage:
//   const { displayed, animClass, busy, navigate } = useCardTransition(index, setIndex)
//   <div className={animClass}>{cards[displayed]}</div>
//   <button onClick={() => navigate(index + 1)}>Next</button>
// ─────────────────────────────────────────────────────────────────────────────

interface CardTransitionResult {
  displayed: number
  animClass: string
  busy:      boolean
  navigate:  (nextIndex: number) => void
}

export function useCardTransition(
  index: number,
  setIndex: (i: number) => void,
): CardTransitionResult {
  const [animClass, setAnimClass] = useState('')
  const [displayed, setDisplayed] = useState(index)
  const [busy,      setBusy]      = useState(false)
  const pendingIndex = useRef<number | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimers() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function navigate(nextIndex: number) {
    if (busy) return
    if (nextIndex === index) return
    setIndex(nextIndex)
  }

  useEffect(() => {
    if (index === displayed && pendingIndex.current === null) return

    clearTimers()
    const direction = index >= displayed ? 'fwd' : 'back'
    pendingIndex.current = index

    setBusy(true)
    setAnimClass(direction === 'fwd' ? ANIM.cardOutFwd : ANIM.cardOutBack)

    timerRef.current = setTimeout(() => {
      setDisplayed(pendingIndex.current ?? index)
      setAnimClass(direction === 'fwd' ? ANIM.cardInFwd : ANIM.cardInBack)

      timerRef.current = setTimeout(() => {
        setAnimClass('')
        setBusy(false)
        pendingIndex.current = null
      }, DURATION.cardEnter)
    }, DURATION.cardExit)

    return clearTimers
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  return { displayed, animClass, busy, navigate }
}

// ─────────────────────────────────────────────────────────────────────────────
// § SPORTS — useAnimatedNumber
// Counts from 0 to `target` over `duration` ms using requestAnimationFrame.
// Re-animates whenever `target` changes.
//
// Usage:
//   const animated = useAnimatedNumber(2252.45, 600)
// ─────────────────────────────────────────────────────────────────────────────

export function useAnimatedNumber(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    startRef.current = null

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now
      const elapsed  = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const ease     = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(target * ease)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [target, duration]) // eslint-disable-line react-hooks/exhaustive-deps

  return value
}

// ─────────────────────────────────────────────────────────────────────────────
// § TRAVEL — useVisible
// IntersectionObserver-based trigger for scroll-into-view animations.
// Returns { ref, visible } — attach ref to a container div, use visible
// to drive fadeUp() or CSS animation class application.
//
// threshold: fraction of element that must be visible before triggering.
// Once visible, stays visible (one-shot — intentional for entrance animations).
//
// Usage:
//   const { ref, visible } = useVisible()
//   <div ref={ref} style={fadeUp(visible)}>...</div>
// ─────────────────────────────────────────────────────────────────────────────

export function useVisible(threshold = 0.15): {
  ref: React.RefObject<HTMLDivElement | null>
  visible: boolean
} {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}

// ─────────────────────────────────────────────────────────────────────────────
// § TRAVEL — fadeUp
// Returns an inline CSSProperties object that drives a fade + lift entrance.
// Use with useVisible() — visible=false = hidden starting state,
// visible=true = animated to final position.
//
// delay: stagger offset in ms. Use multiples of 60-120 for sequential items.
//
// Usage:
//   <div style={fadeUp(visible, 120)}>...</div>
// ─────────────────────────────────────────────────────────────────────────────

export function fadeUp(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity:    visible ? 1 : 0,
    transform:  visible ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 0.78s ease ${delay}ms, transform 0.78s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § TRAVEL — useScrollParallax
// Returns a translateY pixel offset driven by the element's scroll position
// relative to the viewport centre. Apply to image wrappers for a subtle
// depth effect — the image moves at `strength` fraction of scroll delta.
//
// strength: 0.08 = image moves 8% of scroll distance (very subtle).
//           0.14 = moderate. 0.20+ = noticeable. Keep <=0.12 for guide pages.
//
// Usage:
//   const { ref, offset } = useScrollParallax(0.08)
//   <div ref={ref}>
//     <img style={{ transform: `translateY(${offset}px)` }} />
//   </div>
// ─────────────────────────────────────────────────────────────────────────────

export function useScrollParallax(strength = 0.08): {
  ref: React.RefObject<HTMLDivElement | null>
  offset: number
} {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const rect       = el.getBoundingClientRect()
      const centre     = rect.top + rect.height / 2
      const viewCentre = window.innerHeight / 2
      setOffset((centre - viewCentre) * strength)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [strength])

  return { ref, offset }
}

// ─────────────────────────────────────────────────────────────────────────────
// § TRAVEL — useScrollProgress
// Returns a 0->1 progress value as an element scrolls from the bottom of the
// viewport up to its centre. Use to drive scroll-linked opacity, scale, or
// position animations.
//
// 0 = element's top edge is at the bottom of the viewport (just entering)
// 1 = element's top edge is at 35% from top of viewport (well in view)
//
// Usage:
//   const { ref, progress } = useScrollProgress()
//   <div ref={ref} style={{ opacity: progress }}>...</div>
// ─────────────────────────────────────────────────────────────────────────────

export function useScrollProgress(): {
  ref: React.RefObject<HTMLDivElement | null>
  progress: number
} {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const rect  = el.getBoundingClientRect()
      const vh    = window.innerHeight
      const start = vh
      const end   = vh * 0.35
      const p     = Math.min(1, Math.max(0, (start - rect.top) / (start - end)))
      setProgress(p)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return { ref, progress }
}