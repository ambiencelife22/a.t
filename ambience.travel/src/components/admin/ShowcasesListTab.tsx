/* ShowcasesListTab.tsx
 * Skeleton tab. Currently 0 rows in travel_immerse_showcases.
 * Per Seed Reference v8 §19 — content seeding pending.
 *
 * Last updated: S33
 */

import { A } from '../../lib/adminTokens'

export default function ShowcasesListTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
          Admin · Immerse
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
          Showcases
        </div>
      </div>

      <div style={{
        background:   A.bgCard,
        border:       `1px dashed ${A.border}`,
        borderRadius: 14,
        padding:      32,
        textAlign:    'center',
      }}>
        <div style={{ fontSize: 13, color: A.muted, fontFamily: A.font, marginBottom: 8 }}>
          No showcases yet.
        </div>
        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, lineHeight: 1.7 }}>
          Schema landed in S32H. Content seeding pending domain spec —<br/>
          showcase use case and engagement relationship to be defined.
        </div>
      </div>
    </div>
  )
}