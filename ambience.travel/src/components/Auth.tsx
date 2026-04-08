/* Auth.tsx
 * Authentication screen for ambience.travel programme product.
 * Mirrors ambience.SPORTS Auth.tsx in layout and behaviour.
 * Dark theme — matches Layout and the programme product aesthetic.
 * Uses C (landingTypes) and DARK tokens throughout. No light tokens.
 *
 * Modes:
 *   login  — default, shown to all users hitting a gated route
 *   signup — hidden, reachable only via ?signup=1 query param (not linked in UI)
 *
 * Sign-up fields:
 *   first_name — required
 *   last_name  — optional
 *   nickname   — optional
 *   email      — required
 *   password   — required, min 11 chars
 *
 * Sign-up is admin-controlled — not advertised publicly.
 */

import { useState } from 'react'
import { signIn, signUp } from '../lib/auth'
import { C, DARK } from '../lib/landingTypes'
import AmbienceLogo from './AmbienceLogo'

interface AuthProps {
  onAuth:       () => void
  initialMode?: 'login' | 'signup'
}

type Mode = 'login' | 'signup'

const S = {
  labelFaint: {
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color:         DARK.label,
    marginBottom:  6,
  },
  formInput: {
    width:         '100%',
    padding:       '10px 12px',
    fontSize:      14,
    background:    '#1E221E',
    border:        `1px solid ${DARK.cardBorder}`,
    borderRadius:  8,
    color:         DARK.text,
    fontFamily:    "'Plus Jakarta Sans', sans-serif",
    outline:       'none',
    boxSizing:     'border-box' as const,
  },
}

export default function Auth({ onAuth, initialMode = 'login' }: AuthProps) {
  const [mode, setMode]                 = useState<Mode>(initialMode)
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [firstName, setFirstName]       = useState('')
  const [lastName, setLastName]         = useState('')
  const [nickname, setNickname]         = useState('')
  const [error, setError]               = useState<string | null>(null)
  const [loading, setLoading]           = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit() {
    setError(null)

    if (password.length < 11) {
      setError('Password must be at least 11 characters.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        onAuth()
        return
      }
      if (!firstName) {
        setError('First name is required.')
        setLoading(false)
        return
      }
      await signUp(
        email,
        password,
        firstName,
        lastName  || undefined,
        nickname  || undefined,
      )
      onAuth()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     C.bgDark,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     420,
        padding:      32,
        background:   DARK.cardBg,
        borderRadius: 20,
        border:       `1px solid ${DARK.cardBorder}`,
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <img
            src='/emblem.png'
            alt='ambience.travel'
            style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }}
          />
          <div>
            <AmbienceLogo isDark={true} product='travel' height={30} style={{ marginBottom: 2 }} />
            <div style={{
              fontSize:      10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color:         C.gold,
            }}>
              Private Programmes
            </div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize:      20,
            fontWeight:    800,
            color:         DARK.text,
            letterSpacing: '-0.02em',
          }}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </div>
          <div style={{ fontSize: 13, color: DARK.label, marginTop: 4 }}>
            {mode === 'signup'
              ? 'Set up your ambience.travel account.'
              : 'Sign in to access your travel programme.'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Signup-only fields */}
          {mode === 'signup' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={S.labelFaint}>First Name</div>
                  <input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder='Jane'
                    style={S.formInput}
                  />
                </div>
                <div>
                  <div style={S.labelFaint}>
                    Last Name{' '}
                    <span style={{ color: DARK.label, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      (optional)
                    </span>
                  </div>
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder='Doe'
                    style={S.formInput}
                  />
                </div>
              </div>

              <div>
                <div style={S.labelFaint}>
                  Nickname{' '}
                  <span style={{ color: DARK.label, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    (optional)
                  </span>
                </div>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder='How should we address you?'
                  style={S.formInput}
                />
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <div style={S.labelFaint}>Email</div>
            <input
              type='email'
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder='you@example.com'
              style={S.formInput}
            />
          </div>

          {/* Password */}
          <div>
            <div style={S.labelFaint}>
              Password{' '}
              <span style={{ color: DARK.label, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                (min. 11 characters)
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••••••••'
                style={{ ...S.formInput, paddingRight: 40 }}
              />
              <button
                type='button'
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                style={{
                  position:   'absolute',
                  right:      10,
                  top:        '50%',
                  transform:  'translateY(-50%)',
                  background: 'transparent',
                  border:     'none',
                  cursor:     'pointer',
                  color:      showPassword ? DARK.body : DARK.label,
                  padding:    '4px',
                  lineHeight: 1,
                  fontSize:   15,
                  transition: 'color 0.15s',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/>
                    <circle cx='12' cy='12' r='3'/>
                  </svg>
                ) : (
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94'/>
                    <path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19'/>
                    <line x1='1' y1='1' x2='23' y2='23'/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontSize:     13,
              color:        C.negative,
              background:   `${C.negative}15`,
              borderRadius: 8,
              padding:      '10px 14px',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding:      '12px',
              fontSize:     14,
              fontWeight:   700,
              background:   loading ? DARK.label : C.gold,
              color:        C.bgDark,
              borderRadius: 10,
              border:       'none',
              cursor:       loading ? 'not-allowed' : 'pointer',
              fontFamily:   "'Plus Jakarta Sans', sans-serif",
              transition:   'background 0.15s',
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>

        </div>
      </div>
    </div>
  )
}