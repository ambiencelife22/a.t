/* VideoIntroSection.tsx
 * Full-viewport video section — sits between EditorialSection and JourneyMomentsSection.
 * - autoPlay + muted + playsInline as React props (iOS Safari triad)
 * - Lazy loads via IntersectionObserver — video element only mounts when near viewport
 * - Poster/skeleton shown until video is ready
 * - Loop — plays continuously while in view
 * - Pause/play toggle bottom-right
 */

import { useEffect, useRef, useState } from 'react'

const VIDEO_SRC  = '/landing/yacht-aerial.mp4'
const POSTER_SRC = '/landing/yacht-aerial-bup.webp'

export default function VideoIntroSection() {
  const videoRef             = useRef<HTMLVideoElement>(null)
  const sectionRef           = useRef<HTMLDivElement>(null)
  const [loaded,  setLoaded] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [visible, setVisible] = useState(false)

  // Lazy load — mount video element only when section is close to viewport
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.01, rootMargin: '200px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Track loaded state — autoPlay handles the actual play call on iOS
  useEffect(() => {
    const vid = videoRef.current
    if (!vid || !visible) return

    const onCanPlay = () => setLoaded(true)

    vid.addEventListener('canplaythrough', onCanPlay)
    if (vid.readyState >= 3) setLoaded(true)

    return () => vid.removeEventListener('canplaythrough', onCanPlay)
  }, [visible])

  // Keep playing state in sync with actual video state
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    const onPlay  = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    vid.addEventListener('play',  onPlay)
    vid.addEventListener('pause', onPause)
    return () => {
      vid.removeEventListener('play',  onPlay)
      vid.removeEventListener('pause', onPause)
    }
  }, [visible])

  const togglePlay = () => {
    const vid = videoRef.current
    if (!vid) return
    vid.paused ? vid.play() : vid.pause()
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
      {/* Skeleton shimmer — behind poster while it loads */}
      {!loaded && (
        <div
          style={{
            position:       'absolute',
            inset:          0,
            zIndex:         0,
            background:     'linear-gradient(110deg, #0f1310 30%, #1a2018 50%, #0f1310 70%)',
            backgroundSize: '200% 100%',
            animation:      'skeletonShimmer 1.8s ease infinite',
          }}
        />
      )}

      {/* Poster — crossfades out once video is ready */}
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

      {/* Video — autoPlay + muted + playsInline is the iOS Safari triad */}
      {visible && (
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          autoPlay
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

      {/* Pause / play — bottom right */}
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
          opacity:        loaded ? 0.85 : 0,
          transition:     'opacity 0.3s ease',
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>

      <style>{`
        @keyframes skeletonShimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </section>
  )
}