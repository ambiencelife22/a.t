// EngagementDetail.tsx — One engagement, one interface.
// One continuous scroll: engagement editor (identity, status, hero, route,
// destinations, cards, pricing, welcome, archive) flows directly into
// financial outlook (margin, bookings + write panel, expenses).
// No tabs. No switching. Everything visible.
//
// Route: #admin/trips/<url_id> (any detail tab slug redirects here)
// Full-page editors (Programme, Brief) bypass this shell entirely —
// intercepted in AdminShell before this renders.
//
// Last updated: S53I — dissolved tab bar, one-scroll surface.

import { A } from '../../tokens/tokensAdmin'
import EngagementDetailTab from './EngagementDetailTab'
import OutlookTab from './OutlookTab'

export default function EngagementDetail({ urlId }: { urlId: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <EngagementDetailTab urlId={urlId} />

      {/* Financial outlook — flows directly beneath the engagement editor */}
      <div style={{
        borderTop: `1px solid ${A.border}`,
        marginTop: 32,
        paddingTop: 32,
      }}>
        <OutlookTab urlId={urlId} />
      </div>
    </div>
  )
}