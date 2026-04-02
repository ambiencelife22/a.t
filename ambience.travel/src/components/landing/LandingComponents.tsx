import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Section({ children }: { children: ReactNode }) {
  return <div style={{ width: '100%' }}>{children}</div>
}

export function useVisible(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true)
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}

export function fadeUp(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 0.78s ease ${delay}ms, transform 0.78s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  }
}

// Subtle parallax — returns a translateY offset based on element scroll position.
// strength: 0.08 = image moves at 8% of scroll delta (very subtle).
export function useScrollParallax(strength = 0.08) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const centre = rect.top + rect.height / 2
      const viewCentre = window.innerHeight / 2
      setOffset((centre - viewCentre) * strength)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [strength])

  return { ref, offset }
}
// Scroll progress — returns 0→1 as element scrolls from entering viewport bottom
// to reaching the centre. Use to drive scroll-linked animations.
export function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const rect  = el.getBoundingClientRect()
      const vh    = window.innerHeight
      // 0 when bottom of element hits bottom of viewport
      // 1 when top of element hits centre of viewport
      const start = vh
      const end   = vh * 0.35
      const pos   = rect.top
      const p     = Math.min(1, Math.max(0, (start - pos) / (start - end)))
      setProgress(p)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return { ref, progress }
}