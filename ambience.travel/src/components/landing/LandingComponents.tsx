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