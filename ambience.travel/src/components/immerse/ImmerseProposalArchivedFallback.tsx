// ImmerseProposalArchivedFallback.tsx — AXIS-2 client-facing archive surface.
//
// Shown when an engagement's proposal_visibility === 'archived'. The client
// holds a url_id to a proposal that WAS live and has since been archived by the
// operator. This is deliberately NOT a 404 (that is public_view=false, handled
// upstream in the stage EF): an archived proposal degrades gracefully toward
// human contact, never an error and never stale proposal content.
//
// Theme: the immerse client palette (cream / serif), mirroring TripNotFound /
// TripLoading so it reads as native to the client surface. Brand chrome is the
// established /emblem.png asset (same as TripLoading/TripNotFound) — no invented
// logo, tagline, or copy. Contact is text-only by design (no email/link surfaced
// here); the client reaches their travel designer through their existing channel.
//
// Created: S53G (AXIS-2).

import { AMBIENCE, TYPE } from '../../tokens/tokensAmbienceTravel'

// ── Theme (mirrors ImmerseDeliveryPage client palette) ────────────────────────────

const c = AMBIENCE.light

export default function ImmerseProposalArchivedFallback() {  return (
    <div
      style={{
        minHeight:      '100vh',
        background:      c.surface,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            20,
        padding:        '0 24px',
        textAlign:      'center',
        boxSizing:      'border-box',
      }}
    >
      {/* Brand emblem — established asset, not invented chrome */}
      <img src='/emblem.png' alt='' style={{ width: 52, height: 52, opacity: 0.55, marginBottom: 4 }} />

      {/* Eyebrow */}
      <div
        style={{
          fontSize:      10,
          fontFamily:    TYPE.sans,
          fontWeight:    700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color:         c.faint,
        }}
      >
        ambience &middot; travel
      </div>

      {/* Primary message */}
      <div
        style={{
          fontSize:      'clamp(22px, 3vw, 30px)',
          fontFamily:    TYPE.serif,
          color:         c.ink,
          lineHeight:    1.25,
          maxWidth:      520,
        }}
      >
        This proposal is no longer active.
      </div>

      {/* Supporting line — degrade toward human contact */}
      <div
        style={{
          fontSize:   14,
          fontFamily: TYPE.sans,
          color:      c.muted,
          lineHeight: 1.7,
          maxWidth:   440,
        }}
      >
        Please reach out to your travel designer to pick things back up; they
        will be glad to share what's next.
      </div>

      {/* Hairline + return link (to the public site, consistent with TripNotFound) */}
      <div style={{ width: 40, height: 1, background: c.faint, opacity: 0.5, margin: '8px 0 4px' }} />
      <a
        href='https://ambience.travel'
        style={{
          fontSize:       13,
          fontFamily:     TYPE.sans,
          color:          c.gold,
          textDecoration: 'none',
          letterSpacing:  '0.02em',
        }}
      >
        Return to ambience.travel {'\u2192'}
      </a>
    </div>
  )
}