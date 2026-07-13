// ImmerseDeliveryTabShell.tsx — Tab chrome for delivery-stage engagement sections.
//
// A3 Stage 2a (ships dark). Extracted verbatim from ImmerseDeliveryPage's tab
// system: sticky tab bar, mobile menu, PDF download buttons, welcome-as-tab /
// welcome-as-banner logic. Renders the ACTIVE tab's content via SECTION_RENDERERS
// (single source) rather than an inline switch. The surface (Stage 2b) uses this
// for delivery/completed stages; proposal stages render sections sequentially.
//
// Takes the resolved section set (already filtered by show_tab_*), the delivery
// context, and the shell handshake. Owns only tab presentation — section content
// comes from the renderer map.

import { useState, useCallback } from 'react'
import type { EngagementClientData } from '../../queries/queriesImmerseEngagement'
import type { SectionType } from '../../types/typesImmerse'
import type { TimelineItem } from '../../types/typesTimeline'
import type { ExportBranding } from '../../pdf/pdfShared'
import { SECTION_RENDERERS, type ShellHandshake } from './ImmerseSectionRenderers'
import { useImmerseConfirmationPdf } from '../../hooks/useImmerseConfirmationPdf'
import { useImmerseProgrammePdf } from '../../hooks/useImmerseProgrammePdf'
import { useWindowWidth } from '../../hooks/useWindowWidth'
import { AMBIENCE, TYPE } from '../../tokens/tokensAmbienceTravel'

const c = AMBIENCE.light

// Map delivery SectionType -> tab label. Welcome is a synthetic tab (not a
// registry section — it's brief.welcome_letter content) handled separately.
const TAB_LABEL: Partial<Record<SectionType, string>> = {
  brief:        'Engagement Brief',
  programme:    'Programme',
  confirmation: 'Confirmation',
  contacts:     'Contacts',
}

// Order tabs by the registry sortOrder already carried in `sections`.
type DeliveryTab = { id: SectionType | 'welcome'; label: string }

export function ImmerseDeliveryTabShell({
  ctx,
  sections,
  initialTab,
}: {
  ctx:        Extract<EngagementClientData, { stage: 'delivery' }>
  sections:   readonly SectionType[]   // resolved + show_tab_* filtered, in order
  initialTab?: SectionType | 'welcome'
}) {
  const width = useWindowWidth()
  const [tabMenuOpen, setTabMenuOpen] = useState(false)
  const [activeDayLabel, setActiveDayLabel] = useState<string>('')
  const [openDayNav, setOpenDayNav] = useState<(() => void) | null>(null)

  const onActiveDayChange = useCallback((label: string, opener: () => void) => {
    setActiveDayLabel(label)
    setOpenDayNav(() => opener)
  }, [])
  const shell: ShellHandshake = { onActiveDayChange }

  const { pdfReady: briefPdfReady, pdfDownloading: briefPdfDownloading, handleDownloadBrief, handleDownloadTripBrief } = useImmerseConfirmationPdf()
  const { pdfReady: progPdfReady, pdfDownloading: progPdfDownloading, handleDownloadProgramme } = useImmerseProgrammePdf()

  const { clientData, days, entries } = ctx.bundle
  const { trip, brief, house } = clientData

  const welcomeLetter = (brief as { welcome_letter?: string } | null)?.welcome_letter ?? null
  const welcomeAsTab  = (brief as { show_tab_welcome?: boolean } | null)?.show_tab_welcome === true && !!welcomeLetter

  // Build tab list: synthetic welcome tab (if configured) + registry sections in order.
  const tabs: DeliveryTab[] = []
  if (welcomeAsTab) tabs.push({ id: 'welcome', label: 'Welcome' })
  for (const s of sections) {
    const label = TAB_LABEL[s]
    if (label) tabs.push({ id: s, label })
  }

  const resolvedInitial: SectionType | 'welcome' =
    initialTab && tabs.some(t => t.id === initialTab) ? initialTab : (tabs[0]?.id ?? 'confirmation')
  const [activeTab, setActiveTab] = useState<SectionType | 'welcome'>(resolvedInitial)

  function renderWelcome() {
    if (!welcomeLetter) return null
    return (
      <div style={{ padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: c.faint, marginBottom: 28, fontFamily: TYPE.sans }}>Welcome</p>
          {welcomeLetter.split('\n\n').filter(Boolean).map((p, i, arr) => (
            <p key={i} style={{
              fontSize:      i === 0 ? 'clamp(18px,2vw,26px)' : 15,
              fontFamily:    i === 0 ? TYPE.serif : TYPE.sans,
              lineHeight:    1.85,
              color:         i === 0 ? c.ink : c.muted,
              marginBottom:  i === arr.length - 1 ? 0 : 20,
              letterSpacing: i === 0 ? '-0.01em' : 'normal',
            }}>{p}</p>
          ))}
        </div>
      </div>
    )
  }

  async function downloadConfirmationOrBrief() {
    let heroData: string | null = null
    const heroSrc = brief?.hero_image_src || trip.destinations[0]?.hero_image_src || null
    if (heroSrc) {
      try {
        const blob = await fetch(heroSrc).then(r => r.blob())
        heroData = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob) })
      } catch { /* hero optional */ }
    }
    const branding = (brief?.logo_variant ?? 'ambience') as ExportBranding
    if (activeTab === 'brief') {
      handleDownloadTripBrief({ trip, brief, house, destinationName: clientData.destinationName, heroImageData: heroData, elements: clientData.elements, links: clientData.links ?? [], guestDisplayName: clientData.guestDisplayName }, branding)
      return
    }
    handleDownloadBrief({ trip, brief, house, destinationName: clientData.destinationName, heroImageData: heroData, elements: clientData.elements, contacts: clientData.contacts, guestDisplayName: clientData.guestDisplayName }, branding)
  }

  function downloadProgramme() {
    const entriesByDate: Record<string, TimelineItem[]> = {}
    for (const e of entries) {
      if (!entriesByDate[e.entry_date]) entriesByDate[e.entry_date] = []
      entriesByDate[e.entry_date].push(e)
    }
    handleDownloadProgramme({ trip, brief, house, days, entriesByDate, links: clientData.links ?? [], guestDisplayName: clientData.guestDisplayName })
  }

  return (
    <div style={{ background: c.surface }} id='tabs'>
      <div style={{
        position: 'sticky', top: 60, zIndex: 49,
        background: 'rgba(247,245,240,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: width < 640 ? 'none' : `1px solid ${c.lineStrong}`,
        padding: '0 clamp(20px,5vw,48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        {width < 640 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setTabMenuOpen(o => !o)} aria-label='Open tab menu'
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: TYPE.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.gold }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>☰</span>
                <span>{tabs.find(t => t.id === activeTab)?.label ?? 'Menu'}</span>
              </button>
              {tabMenuOpen && (
                <>
                  <div onClick={() => setTabMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 200, zIndex: 70, background: '#fff', border: `1px solid ${c.lineStrong}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {tabs.map(t => (
                      <button key={t.id} onClick={() => { setActiveTab(t.id); setTabMenuOpen(false) }}
                        style={{ textAlign: 'left', padding: '12px 14px', border: 'none', borderRadius: 6, background: activeTab === t.id ? `${c.gold}14` : 'transparent', color: activeTab === t.id ? c.gold : c.ink, fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: TYPE.sans, cursor: 'pointer', transition: 'background 120ms' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {activeTab === 'programme' && activeDayLabel && (
              <button onClick={() => openDayNav?.()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: `1px solid ${c.gold}55`, borderRadius: 20, background: `${c.gold}0D`, cursor: 'pointer', fontFamily: TYPE.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: c.muted, maxWidth: 200, flexShrink: 0, whiteSpace: 'nowrap', transition: 'border-color 150ms, background 150ms' }}>
                <span style={{ fontSize: 11, color: c.gold, flexShrink: 0, lineHeight: 1 }}>☰</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeDayLabel}</span>
                <span style={{ fontSize: 12, color: c.gold, flexShrink: 0, lineHeight: 1, marginLeft: 2 }}>{'\u203a'}</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 0 }}>
            {tabs.map(t => (
              <button key={t.id} id={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: '16px 20px', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? c.gold : 'transparent'}`, background: 'transparent', color: activeTab === t.id ? c.gold : c.faint, fontSize: 11, fontWeight: activeTab === t.id ? 700 : 500, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: TYPE.sans, cursor: 'pointer', transition: 'all 150ms ease', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {(activeTab === 'confirmation' || activeTab === 'brief') && (
            <button disabled={!briefPdfReady || briefPdfDownloading} onClick={downloadConfirmationOrBrief}
              style={{ fontFamily: TYPE.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: briefPdfReady ? 'pointer' : 'not-allowed', background: c.gold, color: c.ink, opacity: briefPdfReady && !briefPdfDownloading ? 1 : 0.45, transition: 'opacity 150ms' }}>
              {briefPdfDownloading ? 'Generating\u2026' : activeTab === 'confirmation' ? 'Confirmation PDF' : 'Brief PDF'}
            </button>
          )}
          {activeTab === 'programme' && (
            <button disabled={!progPdfReady || progPdfDownloading} onClick={downloadProgramme}
              style={{ fontFamily: TYPE.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: progPdfReady ? 'pointer' : 'not-allowed', background: c.gold, color: c.ink, opacity: progPdfReady && !progPdfDownloading ? 1 : 0.45, transition: 'opacity 150ms' }}>
              {progPdfDownloading ? 'Generating\u2026' : 'Programme PDF'}
            </button>
          )}
        </div>
      </div>

      <div style={{ background: c.surface, minHeight: '60vh' }}>
        {activeTab === 'welcome'
          ? renderWelcome()
          : SECTION_RENDERERS[activeTab](ctx, shell)}
      </div>

      <div style={{ padding: '40px clamp(20px,6vw,80px)', textAlign: 'center', borderTop: `1px solid ${c.lineStrong}` }}>
        <div style={{ fontSize: 10, fontFamily: TYPE.sans, color: c.faint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Tailored Travel Design &nbsp;&middot;&nbsp; Concierge Support &nbsp;&middot;&nbsp;
          <a href='https://ambience.travel' style={{ color: c.faint, textDecoration: 'none' }}> ambience.travel</a>
        </div>
      </div>
    </div>
  )
}