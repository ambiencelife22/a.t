// EngagementDetail.tsx — One engagement, one interface.
// One continuous scroll: engagement editor + financial outlook.
// Both render immediately — no gate, no flash, no sequencing.
//
// Last updated: S53I — removed engagementReady gate.

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