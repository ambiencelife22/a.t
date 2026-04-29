// ImmerseStateScreens.tsx — Shared loading + error screens for immerse routes.
// Consumed by ImmerseEngagementRoute (overview) and DestinationPage (subpage).
// Both screens render *inside* an ImmerseLayout — the layout is the caller's
// responsibility, so the screens themselves are chrome-free panels designed
// to fill the layout's content area.
//
// Token policy:
//   ImmerseLayout uses ID.bg as the page background (dark — #0E110E ish).
//   Both screens render on that dark surface, so colours come from the ID.*
//   token family directly. Earlier hardcoded hex strings made the message
//   text near-black on near-black — invisible on the immerse dark surface.
//
// Last updated: S32F — Added TravelLoadingScreen: branded full-screen loading
//   state with emblem shimmer + "Preparing Your Experiences" copy. Used by
//   DestinationPage (and engagement load) where the full branded experience
//   is wanted. Existing LoadingScreen kept as-is — minimal text fallback for
//   contexts where chrome is undesirable. Min display time prevents flash.
// Prior: S32 — Replaced hardcoded hex (#171917, #7A8476, #C9B88E)
//   with ID.text / ID.muted / ID.gold tokens from landingColors. The dark-on-
//   dark "This proposal is not available" message is now legible. Outbound
//   link goes to ambience.travel marketing site.
// Prior: S30E perf — Extracted from ImmerseEngagementRoute to fix the
//   destination subpage white-flash. DestinationPage was returning `null`
//   while loading, producing an unstyled gap between unmount and mount.
//   Both consumers now render LoadingScreen inside ImmerseLayout during
//   load, eliminating the flash.

import { useState, useEffect } from 'react'
import { ID } from '../../lib/landingColors'

// ─── Minimal text loader (preserved) ─────────────────────────────────────────

export function LoadingScreen() {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{
        fontSize:      13,
        color:         ID.muted,
        letterSpacing: '0.06em',
      }}>
        Loading Your Experience
      </div>
    </div>
  )
}

// ─── Branded full-screen loader (S32F) ───────────────────────────────────────
// Gold-shimmer emblem + "Preparing Your Experience".
// Renders inside ImmerseLayout — caller owns chrome.
//
// Sequence:
//   0ms       — screen appears, emblem fades in
//   180ms     — copy fades in
//   continuous — emblem shimmer sweep
//   on ready  — fades out (300ms), then unmounts
//
// minDuration prevents flash on cached loads.

interface TravelLoadingScreenProps {
  ready?:       boolean
  minDuration?: number
  copy?:        string
}

export function TravelLoadingScreen({
  ready       = false,
  minDuration = 600,
  copy        = 'Preparing Your Experience',
}: TravelLoadingScreenProps) {
  const [minElapsed, setMinElapsed] = useState(false)
  const [exiting, setExiting]       = useState(false)
  const [gone, setGone]             = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), minDuration)
    return () => clearTimeout(t)
  }, [minDuration])

  useEffect(() => {
    if (ready && minElapsed && !exiting) {
      setExiting(true)
      const t = setTimeout(() => setGone(true), 300)
      return () => clearTimeout(t)
    }
  }, [ready, minElapsed, exiting])

  if (gone) return null

  return (
    <div
      style={{
        minHeight:      'calc(100vh - 60px)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            22,
        animation:      exiting ? 'immerseLoadFadeOut 300ms ease forwards' : 'immerseLoadFadeIn 400ms ease both',
      }}
    >
      {/* Emblem with gold shimmer sweep */}
      <div
        style={{
          position:     'relative',
          width:        72,
          height:       72,
          borderRadius: '50%',
          overflow:     'hidden',
        }}
      >
        <img
          src='/emblem.png'
          alt=''
          style={{
            width:    '100%',
            height:   '100%',
            display:  'block',
            opacity:  0.85,
          }}
        />
        {/* Gold sweep overlay — masked to emblem shape via parent overflow:hidden + border-radius */}
        <div
          style={{
            position:       'absolute',
            inset:          0,
            background:     `linear-gradient(105deg, transparent 30%, ${ID.gold}55 50%, transparent 70%)`,
            backgroundSize: '250% 100%',
            mixBlendMode:   'screen',
            animation:      'immerseEmblemShimmer 2.2s ease-in-out infinite',
            pointerEvents:  'none',
          }}
        />
      </div>

      {/* Copy */}
      <div style={{
        fontSize:      12,
        color:         ID.muted,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight:    600,
      }}>
        {copy}
      </div>
    </div>
  )
}

// ─── Not-found / error ───────────────────────────────────────────────────────

export function NotFound({ message }: { message: string }) {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
      padding:        '0 24px',
      textAlign:      'center',
    }}>
      <div style={{
        fontSize:   20,
        fontWeight: 600,
        color:      ID.text,
      }}>
        {message}
      </div>
      <a
        href='https://ambience.travel'
        style={{
          fontSize:       13,
          color:          ID.gold,
          textDecoration: 'none',
          letterSpacing:  '0.04em',
        }}
      >
        Return to ambience.travel →
      </a>
    </div>
  )
}