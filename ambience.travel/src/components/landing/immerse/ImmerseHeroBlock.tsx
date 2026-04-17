import { useEffect, useRef, useState } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp } from './ImmerseComponents'

export function ImmerseHeroBlock({
  imageSrc,
  imageAlt,
  title,
  subtitle,
}: {
  imageSrc: string
  imageAlt?: string
  title?: string
  subtitle?: string
}) {
  const isMobile = useImmerseMobile()
  const { ref, visible } = useImmerseVisible(0.08)
  const sectionRef = useRef<HTMLElement>(null)
  const [cardOpacity, setCardOpacity] = useState(1)

  useEffect(() => {
    function onScroll() {
      const el = sectionRef.current
      if (!el) return

      const { top, height } = el.getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, (-top) / (height * 0.9)))
      setCardOpacity(1 - progress * 0.35)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const shellLayers = [
    'radial-gradient(circle at center, rgba(0,0,0,0) 38%, rgba(0,0,0,0.42) 100%)',
    'linear-gradient(180deg, rgba(3,6,18,0.16) 0%, rgba(2,4,12,0.48) 100%)',
    'linear-gradient(90deg, rgba(6,6,6,0.74) 0%, rgba(6,6,6,0.44) 30%, rgba(6,6,6,0.18) 62%, rgba(6,6,6,0.30) 100%)',
    `url('${imageSrc}')`,
  ]

  return (
    <section
      ref={sectionRef}
      style={{
        padding: 0,
        margin: 0,
        borderTop: '1px solid rgba(216,181,106,0.10)',
        borderBottom: '1px solid rgba(216,181,106,0.08)',
      }}
    >
      <div
        aria-label={imageAlt || title || 'Romantic destination image'}
        style={{
          position: 'relative',
          minHeight: isMobile ? 480 : 620,
          backgroundImage: shellLayers.join(', '),
          backgroundAttachment: isMobile
  ? 'scroll'
  : 'scroll, scroll, scroll, fixed',
          backgroundSize: 'auto, auto, auto, cover',
          backgroundPosition: 'center, center, center, center',
          backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: isMobile ? 'calc(100% - 24px)' : 'min(1220px, calc(100% - 36px))',
            margin: '0 auto',
            padding: isMobile ? '34px 0' : '44px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: isMobile ? 'center' : 'flex-end',
            }}
          >
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              style={{
                width: 'min(680px, 100%)',
                padding: isMobile ? 22 : 34,
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 30,
                background: 'linear-gradient(180deg, rgba(12,12,12,0.18), rgba(12,12,12,0.10))',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
                opacity: cardOpacity,
                transition: 'opacity 0.08s linear',
              }}
            >
              {title && (
                <div
                  style={{
                    fontSize: isMobile ? 42 : 'clamp(54px, 6vw, 86px)',
                    lineHeight: 0.95,
                    letterSpacing: '-0.02em',
                    fontWeight: 400,
                    fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif',
                    marginBottom: subtitle ? 14 : 0,
                    color: ID.text,
                  }}
                >
                  {title.split(' ').map((word, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        marginRight: '0.22em',
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0)' : 'translateY(14px)',
                        transition: `opacity 0.7s ease ${100 + i * 55}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${100 + i * 55}ms`,
                        willChange: 'opacity, transform',
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              )}

              {subtitle && (
                <p
                  style={{
                    color: ID.muted,
                    fontSize: isMobile ? 15 : 17,
                    lineHeight: 1.84,
                    maxWidth: 620,
                    margin: 0,
                    ...immerseFadeUp(visible, 220),
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}