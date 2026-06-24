// guidePageStyles.ts — style objects for guide page components
// What it owns: all React.CSSProperties constants for guide layer components:
//   DiningGuidePage.tsx, PlanYourVisit.tsx, GuideSectionBreak.tsx
// What it does not own: token definitions (landingColors), component-local styles
//
// Last updated: S52 — Section break styles added for GuideSectionBreak.
//   Replaces the lightweight supplementaryDivider* styles with full editorial
//   treatment: eyebrow + serif heading + descriptor + generous breathing room.
//   Old supplementaryDivider* styles removed.
// Prior: S40 — PlanYourVisit styles added.
// Prior: S40 — extracted from DiningGuidePage.tsx inline styles.

import React from 'react'
import { ID, IMMERSE, FONTS } from '../tokens/tokensLanding'
import { C } from '../tokens/tokensProgramme'

// ── DiningGuidePage ───────────────────────────────────────────────────────────

export const pageStyle: React.CSSProperties = {
  width: 'min(1480px, 100%)',
  margin: '0 auto',
  padding: '42px 34px 64px',
}

export const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 20,
  margin: '34px 4px 22px',
}

export const sectionTitleH2Style: React.CSSProperties = {
  margin: 0,
  fontFamily: FONTS.serif,
  fontSize: 38,
  fontWeight: 400,
  letterSpacing: '-0.04em',
  color: ID.text,
}

export const sectionTitleCountStyle: React.CSSProperties = {
  margin: '4px 0 0',
  color: ID.muted,
  fontSize: 14,
}

export const downloadBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 18px',
  border: `1px solid ${IMMERSE.goldBorder}`,
  borderRadius: 999,
  background: IMMERSE.goldTint,
  color: ID.gold,
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  transition: 'background 180ms ease, border-color 180ms ease',
  whiteSpace: 'nowrap',
}

export const downloadBtnDisabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

export const downloadIconStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1,
}

export const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
  gap: 22,
}

export const disclaimerStyle: React.CSSProperties = {
  marginTop: 48,
  paddingTop: 24,
  borderTop: `1px solid ${IMMERSE.tableBorder}`,
}

export const disclaimerTextStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  fontSize: 12,
  lineHeight: 1.7,
  fontStyle: 'italic',
  maxWidth: 720,
}

export const messageBlockStyle: React.CSSProperties = {
  padding: '120px 24px',
  textAlign: 'center',
  border: `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 30,
  background: 'rgba(255,255,255,0.025)',
}

export const messageTextStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  fontSize: 15,
  lineHeight: 1.55,
  fontStyle: 'italic',
}

export const emptyStateStyle: React.CSSProperties = {
  padding: '80px 24px',
  textAlign: 'center',
  border: `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 30,
  background: 'rgba(255,255,255,0.025)',
}

export const emptyStateTextStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  fontSize: 16,
  lineHeight: 1.55,
  fontStyle: 'italic',
}

// ── PlanYourVisit ─────────────────────────────────────────────────────────────

export const pyvSectionStyle: React.CSSProperties = {
  position: 'relative',
  marginTop: 80,
  paddingTop: 64,
  paddingBottom: 72,
  borderTop: `1px solid ${IMMERSE.tableBorder}`,
  overflow: 'hidden',
}

export const pyvScanLineStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  height: 1,
  width: '100%',
  background: 'rgba(216,181,106,0.45)',
  animation: 'immerseGoldScan 1.1s cubic-bezier(0.16,1,0.3,1) both',
  pointerEvents: 'none',
  zIndex: 2,
}

export const pyvInnerStyle: React.CSSProperties = {
  width: 'min(1480px, calc(100% - 68px))',
  margin: '0 auto',
}

export const pyvHeaderRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 48,
  alignItems: 'end',
  marginBottom: 36,
}

export const pyvHeaderLeftStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

export const pyvEyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: ID.gold,
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
  animation: 'immerseEyebrowSettle 0.7s cubic-bezier(0.16,1,0.3,1) both',
}

export const pyvHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: FONTS.serif,
  fontSize: 'clamp(32px, 4vw, 52px)',
  fontWeight: 400,
  letterSpacing: '-0.03em',
  lineHeight: 1.0,
  color: ID.text,
}

export const pyvIntroStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  fontSize: 16,
  lineHeight: 1.7,
  alignSelf: 'end',
}

export const pyvRuleStyle: React.CSSProperties = {
  height: 1,
  background: `linear-gradient(90deg, ${ID.gold}55 0%, ${ID.gold}22 60%, transparent 100%)`,
  marginBottom: 36,
}

export const pyvListStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
  gap: '20px 48px',
}

export const pyvItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 14,
  alignItems: 'flex-start',
}

export const pyvDotStyle: React.CSSProperties = {
  color: ID.gold,
  fontSize: 22,
  lineHeight: 1.15,
  flexShrink: 0,
  fontWeight: 700,
  marginTop: -1,
}

export const pyvItemTextStyle: React.CSSProperties = {
  color: ID.muted,
  fontSize: 15,
  lineHeight: 1.65,
}

// ── GuideSectionBreak ─────────────────────────────────────────────────────────
// Editorial section break between venue groups (e.g. "Also nearby", "Recently
// closed"). Sits inline in the grid via gridColumn 1/-1, full content width.
//
// Treatment: generous breathing room above and below, gold top rule, eyebrow
// in uppercase gold, serif heading matching the main "Selected tables" register,
// descriptor in muted prose. Reads as a chapter break, not a row separator.

export const sectionBreakStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  marginTop: 56,
  marginBottom: 12,
  paddingTop: 36,
  borderTop: `1px solid ${ID.gold}33`,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

export const sectionBreakEyebrowStyle: React.CSSProperties = {
  color: ID.gold,
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

export const sectionBreakHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: FONTS.serif,
  fontSize: 'clamp(28px, 3.4vw, 38px)',
  fontWeight: 400,
  letterSpacing: '-0.04em',
  lineHeight: 1.05,
  color: ID.text,
}

export const sectionBreakDescriptorStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  fontSize: 15,
  lineHeight: 1.7,
  maxWidth: 640,
}