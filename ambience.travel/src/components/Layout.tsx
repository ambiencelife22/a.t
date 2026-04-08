/* Layout.tsx
 * Global authenticated layout for ambience.travel programme product.
 * Top nav bar with hamburger — no persistent sidebar.
 * Drawer slides in from the right — consistent with ProgrammeLayout.
 *
 * Pages: dashboard | programme | profile
 */

import { useState, useContext, type ReactNode } from 'react'
import { C } from '../lib/theme'
import { ThemeContext } from '../lib/ThemeContext'
import AmbienceLogo from './AmbienceLogo'

export type Page = 'dashboard' | 'programme' | 'profile'

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard',
  programme: 'My Programme',
  profile:   'My Account',
}

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: '▦' },
  { id: 'programme', label: 'My Programme', icon: '◎' },
  { id: 'profile',   label: 'My Account',   icon: '⊙' },
]

interface LayoutProps {
  activePage: Page
  onNavigate: (page: Page) => void
  onSignOut:  () => void
  guestName?: string
  children:   ReactNode
}

export default function Layout({ activePage, onNavigate, onSignOut, guestName, children }: LayoutProps) {
  const { isDark, toggleTheme } = useContext(ThemeContext)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function navigate(page: Page) {
    onNavigate(page)
    setDrawerOpen(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif", overflowX: 'hidden' }}>

      {/* ── Fixed top nav ── */}
      <nav style={{
        position:       'fixed',
        top: 0, left: 0, right: 0,
        zIndex:         50,
        height:         60,
        background:     isDark ? 'rgba(23,25,23,0.92)' : 'rgba(247,244,238,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom:   `1px solid ${C.border}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 clamp(16px,4vw,40px)',
      }}>

        {/* Logo — clicking goes to dashboard */}
        <button
          onClick={() => navigate('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <img src='/emblem.png' alt='ambience.travel' style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
          <AmbienceLogo isDark={isDark} product='travel' height={44} />
        </button>

        {/* Right — active page label + theme toggle + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: C.muted, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {PAGE_TITLES[activePage]}
          </span>

          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '5px 9px', cursor: 'pointer',
              fontSize: 13, lineHeight: 1, color: C.muted,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.gold; (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderGold }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.muted; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
          >
            {isDark ? '☀' : '☾'}
          </button>

          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              color: C.gold, fontSize: 16, lineHeight: 1,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderGold}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = C.border}
            aria-label='Open menu'
          >
            ☰
          </button>
        </div>
      </nav>

      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }}
        />
      )}

      {/* ── Slide-in drawer ── */}
      <div style={{
        position:      'fixed',
        top: 0, right: 0, bottom: 0,
        width:         260,
        zIndex:        70,
        background:    C.bgSidebar,
        borderLeft:    `1px solid ${C.border}`,
        transform:     drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:    'transform 0.25s ease',
        display:       'flex',
        flexDirection: 'column',
        pointerEvents: drawerOpen ? 'all' : 'none',
      }}>

        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', height: 60, borderBottom: `1px solid ${C.border}`,
        }}>
          {guestName && (
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {guestName}
            </div>
          )}
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 20, lineHeight: 1, padding: 4, flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  background: isActive ? `rgba(201,184,142,0.10)` : 'transparent',
                  border: isActive ? `1px solid ${C.borderGold}` : '1px solid transparent',
                  color: isActive ? C.gold : C.muted,
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={onSignOut}
            style={{
              width: '100%', padding: '8px', fontSize: 12, fontWeight: 600,
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 8, color: C.faint, cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.negative; (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.negative}60` }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.faint; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ paddingTop: 60, overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,40px)', width: '100%', boxSizing: 'border-box' }}>
          {children}
        </div>
      </div>
    </div>
  )
}