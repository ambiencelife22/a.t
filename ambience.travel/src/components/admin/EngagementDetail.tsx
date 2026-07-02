// EngagementDetail.tsx — One engagement, one interface.
// One continuous scroll: engagement editor flows directly into financial outlook.
// No tabs. No switching. Everything visible.
//
// Resolves url_id -> engagement_id once at this level and passes it down to
// both EngagementDetailTab and OutlookTab — eliminates the double lookup that
// was causing the flash (OutlookTab was doing its own independent resolution).
//
// Route: #admin/trips/<url_id>
// Full-page editors (Programme, Brief) bypass this shell — intercepted in AdminShell.
//
// Last updated: S53I — single url_id resolution, passed to both children.

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { supabase } from '../../lib/supabase'
import EngagementDetailTab from './EngagementDetailTab'
import OutlookTab from './OutlookTab'

export default function EngagementDetail({ urlId }: { urlId: string }) {
  const [engagementId, setEngagementId] = useState<string | null>(null)
  const [notFound,     setNotFound]     = useState(false)

  useEffect(() => {
    setEngagementId(null)
    setNotFound(false)
    supabase
      .from('travel_immerse_engagements')
      .select('id')
      .eq('url_id', urlId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); return }
        setEngagementId(data.id)
      })
  }, [urlId])

  if (notFound) {
    return (
      <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '60px 0', textAlign: 'center' }}>
        Engagement not found.
      </div>
    )
  }

  if (!engagementId) {
    return (
      <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '60px 0', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <EngagementDetailTab urlId={urlId} />

      <div style={{ borderTop: `1px solid ${A.border}`, marginTop: 32, paddingTop: 32 }}>
        <OutlookTab urlId={urlId} engagementId={engagementId} />
      </div>
    </div>
  )
}