/* _adminIcons.tsx
 * Custom SVG icon components for AmbienceAdmin sidebar.
 * Drop-in replacement for lucide-react - same props interface.
 * All icons: 16x16 viewBox, stroke-based, no fill.
 *
 * Added: S43 - replaced lucide-react dependency.
 */

import type { CSSProperties } from 'react'

type IconProps = {
  size?:        number
  color?:       string
  strokeWidth?: number
  style?:       CSSProperties
}

// ─── Plane (Immerse) ──────────────────────────────────────────────────────────
// Minimal side-profile aircraft, nose pointing right-up.

export function Plane({ size = 16, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={style}
    >
      <path
        d='M2 10.5 L8.5 3.5 C9.5 2.4 11 2.2 12 3 C13 3.8 13 5.2 12 6 L9.5 8 L11 13 L9 11.5 L7.5 9 L5 10.5 L5.5 12.5 L4 11.5 L2 10.5Z'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin='round'
        strokeLinecap='round'
      />
    </svg>
  )
}

// ─── BookOpen (Guides) ────────────────────────────────────────────────────────
// Open book, spine in centre, two pages splayed.

export function BookOpen({ size = 16, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={style}
    >
      {/* Left page */}
      <path
        d='M8 13 C8 13 4.5 11.5 2 12.5 L2 4 C4.5 3 8 4.5 8 4.5'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      {/* Right page */}
      <path
        d='M8 13 C8 13 11.5 11.5 14 12.5 L14 4 C11.5 3 8 4.5 8 4.5'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      {/* Spine */}
      <line x1='8' y1='4.5' x2='8' y2='13' stroke={color} strokeWidth={strokeWidth} strokeLinecap='round' />
    </svg>
  )
}

// ─── Library (Library) ───────────────────────────────────────────────────────
// Three books standing upright, varying heights.

export function Library({ size = 16, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={style}
    >
      {/* Left book (tallest) */}
      <rect x='2' y='3' width='2.5' height='10' rx='0.5' stroke={color} strokeWidth={strokeWidth} />
      {/* Middle book */}
      <rect x='6' y='5' width='2.5' height='8' rx='0.5' stroke={color} strokeWidth={strokeWidth} />
      {/* Right book */}
      <rect x='10' y='4' width='2.5' height='9' rx='0.5' stroke={color} strokeWidth={strokeWidth} />
      {/* Base line */}
      <line x1='1.5' y1='13.5' x2='14.5' y2='13.5' stroke={color} strokeWidth={strokeWidth} strokeLinecap='round' />
    </svg>
  )
}

// ─── Home (House) ─────────────────────────────────────────────────────────────
// Clean house outline: pitched roof + walls + centred door.

export function Home({ size = 16, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={style}
    >
      {/* Roof */}
      <path
        d='M2 7.5 L8 2.5 L14 7.5'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      {/* Walls */}
      <path
        d='M3.5 6.5 L3.5 13.5 L12.5 13.5 L12.5 6.5'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      {/* Door */}
      <path
        d='M6.5 13.5 L6.5 10 Q6.5 9 8 9 Q9.5 9 9.5 10 L9.5 13.5'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

// ─── Layout (Programme) ───────────────────────────────────────────────────────
// Dashboard grid: top bar + two columns below.

export function LayoutGrid({ size = 16, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={style}
    >
      {/* Outer border */}
      <rect x='2' y='2' width='12' height='12' rx='1.5' stroke={color} strokeWidth={strokeWidth} />
      {/* Top bar divider */}
      <line x1='2' y1='6' x2='14' y2='6' stroke={color} strokeWidth={strokeWidth} />
      {/* Vertical column divider */}
      <line x1='8' y1='6' x2='8' y2='14' stroke={color} strokeWidth={strokeWidth} />
    </svg>
  )
}