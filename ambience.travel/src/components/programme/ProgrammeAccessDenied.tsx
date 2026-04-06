/* ProgrammeAccessDenied.tsx
 * Shown when an authenticated user has no guest access to the requested programme.
 * Dark theme — matches Auth.tsx and ProgrammeLayout aesthetic.
 * Classy, minimal, personal. No error language, no technical detail.
 * Rendered by ProgrammeRoute when Supabase returns no programme for the current user.
 */

import { signOut } from '../../lib/auth'
import { C, DARK } from '../../lib/landingTypes'
import AmbienceLogo from '../AmbienceLogo'

interface FallbackProgramme {
  url:        string
  guestNames: string
}

interface ProgrammeAccessDeniedProps {
  email:             string
  fallbackProgramme?: FallbackProgramme
}

export default function ProgrammeAccessDenied({ email, fallbackProgramme }: ProgrammeAccessDeniedProps) {

  async function handleSignOut() {
    await signOut()
    window.location.reload()
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     C.bgDark,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     "'Plus Jakarta Sans', sans-serif",
      padding:        24,
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     420,
        padding:      40,
        background:   DARK.cardBg,
        borderRadius: 20,
        border:       `1px solid ${DARK.cardBorder}`,
        textAlign:    'center',
      }}>

        {/* Logo */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            12,
          marginBottom:   36,
        }}>
          <img
            src='/emblem.png'
            alt='ambience.travel'
            style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }}
          />
          <AmbienceLogo isDark={true} product='travel' height={28} />
        </div>

        {/* Divider */}
        <div style={{
          width:        40,
          height:       1,
          background:   C.gold,
          margin:       '0 auto 32px',
          opacity:      0.5,
        }} />

        {/* Message — branches on whether a fallback programme exists */}
        <div style={{
          fontSize:      20,
          fontWeight:    800,
          color:         DARK.text,
          letterSpacing: '-0.02em',
          marginBottom:  12,
        }}>
          No programme found
        </div>

        <div style={{
          fontSize:     14,
          color:        DARK.body,
          lineHeight:   1.7,
          marginBottom: 8,
        }}>
          {fallbackProgramme
            ? 'This programme is not linked to your account.'
            : 'There is no travel programme linked to this account.'}
        </div>

        <div style={{
          fontSize:     12,
          color:        DARK.label,
          lineHeight:   1.6,
          marginBottom: 36,
        }}>
          Signed in as {email}
        </div>

        {/* Go to my programme — only shown when a fallback exists */}
        {fallbackProgramme && (
          <a
            href={fallbackProgramme.url}
            style={{
              display:       'block',
              width:         '100%',
              padding:       '12px',
              fontSize:      13,
              fontWeight:    700,
              background:    C.gold,
              color:         C.bgDark,
              borderRadius:  10,
              textDecoration:'none',
              fontFamily:    "'Plus Jakarta Sans', sans-serif",
              letterSpacing: '0.02em',
              marginBottom:  12,
              boxSizing:     'border-box',
            }}
          >
            Go to my programme
          </a>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{
            width:        '100%',
            padding:      '12px',
            fontSize:     13,
            fontWeight:   700,
            background:   'transparent',
            color:        C.gold,
            border:       `1px solid rgba(201,184,142,0.3)`,
            borderRadius: 10,
            cursor:       'pointer',
            fontFamily:   "'Plus Jakarta Sans', sans-serif",
            letterSpacing:'0.02em',
            transition:   'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = C.gold
            ;(e.currentTarget as HTMLButtonElement).style.color = DARK.text
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,184,142,0.3)'
            ;(e.currentTarget as HTMLButtonElement).style.color = C.gold
          }}
        >
          Sign out
        </button>

        {/* Footer note */}
        <div style={{
          marginTop:  24,
          fontSize:   11,
          color:      DARK.label,
          lineHeight: 1.6,
        }}>
          If you believe this is an error, please contact your travel adviser.
        </div>

      </div>
    </div>
  )
}