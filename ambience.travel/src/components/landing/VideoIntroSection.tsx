/* VideoIntroSection.tsx
 * Full-viewport pre-intro video section.
 * - Lazy loads via IntersectionObserver
 * - Poster image shown as skeleton until video can play
 * - Autoplay, muted, loop
 * - Pause/play toggle button (bottom-right)
 * - scroll-snap / user must scroll to continue
 */

import { useEffect, useRef, useState } from 'react'
import { C } from '../../lib/landingTypes'

const VIDEO_SRC  = '/landing/yacht-aerial.mp4'
const POSTER_SRC = '/landing/yacht-aerial-bup.webp'

export default function VideoIntroSection() {
  const videoRef              = useRef<HTMLVideoElement>(null)
  const sectionRef            = useRef<HTMLDivElement>(null)
  const [loaded,  setLoaded]  = useState(false)   // video has enough data to play
  const [playing, setPlaying] = useState(true)
  const [visible, setVisible] = useState(false)   // section in viewport → trigger load

  // Lazy load: start loading only when section enters viewport
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.01 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Attempt autoplay once video element is ready
  useEffect(() => {
    const vid = videoRef.current
    if (!vid || !visible) return

    const onCanPlay = () => {
      setLoaded(true)
      vid.play().catch(() => setPlaying(false))
    }

    vid.addEventListener('canplaythrough', onCanPlay)

    // If already ready (cached)
    if (vid.readyState >= 3) onCanPlay()

    return () => vid.removeEventListener('canplaythrough', onCanPlay)
  }, [visible])

  const togglePlay = () => {
    const vid = videoRef.current
    if (!vid) return
    if (vid.paused) {
      vid.play()
      setPlaying(true)
    } else {
      vid.pause()
      setPlaying(false)
    }
  }

  return (
    <section
      ref={sectionRef}
      style={{
        position:   'relative',
        width:      '100%',
        height:     '100svh',
        overflow:   'hidden',
        background: '#0A0D0A',
        flexShrink: 0,
      }}
    >
      {/* Poster — shown until video loads */}
      <div
        style={{
          position:           'absolute',
          inset:              0,
          backgroundImage:    `url(${POSTER_SRC})`,
          backgroundSize:     'cover',
          backgroundPosition: 'center',
          opacity:            loaded ? 0 : 1,
          transition:         'opacity 1.2s ease',
          zIndex:             1,
        }}
      />

      {/* Skeleton shimmer — shown while poster itself loads */}
      {!loaded && (
        <div
          style={{
            position:   'absolute',
            inset:      0,
            zIndex:     0,
            background: 'linear-gradient(110deg, #0f1310 30%, #1a2018 50%, #0f1310 70%)',
            backgroundSize: '200% 100%',
            animation:  'skeletonShimmer 1.8s ease infinite',
          }}
        />
      )}

      {/* Video */}
      {visible && (
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted
          loop
          playsInline
          preload='auto'
          style={{
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            opacity:    loaded ? 1 : 0,
            transition: 'opacity 1.2s ease',
            zIndex:     2,
          }}
        />
      )}

      {/* Pause / play button — bottom right */}
      <button
        onClick={togglePlay}
        title={playing ? 'Pause' : 'Play'}
        aria-label={playing ? 'Pause video' : 'Play video'}
        style={{
          position:       'absolute',
          right:          24,
          bottom:         'calc(32px + env(safe-area-inset-bottom))',
          zIndex:         10,
          width:          40,
          height:         40,
          borderRadius:   '50%',
          background:     'rgba(0,0,0,0.40)',
          border:         '1px solid rgba(255,255,255,0.18)',
          color:          'rgba(255,255,255,0.80)',
          fontSize:       14,
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          transition:     'opacity 0.2s ease',
          opacity:        loaded ? 0.85 : 0,
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>

      {/* Scroll indicator — bottom centre */}
      <div
        style={{
          position:       'absolute',
          bottom:         'calc(36px + env(safe-area-inset-bottom))',
          left:           '50%',
          transform:      'translateX(-50%)',
          zIndex:         10,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            8,
          opacity:        loaded ? 0.6 : 0,
          transition:     'opacity 1s ease 1.5s',
          pointerEvents:  'none',
        }}
      >
        <span
          style={{
            fontSize:      10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         'rgba(255,255,255,0.7)',
          }}
        >
          scroll
        </span>
        <div
          style={{
            width:      1,
            height:     36,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), transparent)',
            animation:  'scrollPulse 2s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes skeletonShimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        @keyframes scrollPulse {
          0%, 100% { opacity: 0.5; transform: scaleY(1) }
          50%       { opacity: 1;   transform: scaleY(1.12) }
        }
      `}</style>
    </section>
  )
}