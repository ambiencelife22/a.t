// useWindowWidth — reactive viewport width, SSR-safe.
// Canonical home (Collapse A · A5). Returns the current window width in px,
// updating on resize; SSR guard returns 1200 when window is undefined.
// For a boolean "is mobile" check on immerse surfaces, prefer useImmerseMobile
// (ImmerseComponents). This hook returns the raw number for callers that need
// the width itself or their own breakpoint comparison.
import { useEffect, useState } from 'react'

export function useWindowWidth(): number {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}
