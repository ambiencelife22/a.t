// SignatureExperiencePage.tsx — page compositor for ambience.travel signature experiences
// Resolves slug → data file, composes all sections.
// Route: ambience.travel/experiences/:slug
// Last updated: S9

import { experience as iceland4e } from '../../../data/experiences/iceland-4e'
import ExperiencesLayout    from '../../layouts/ExperiencesLayout'
import SignatureHero        from './SignatureHero'
import SignatureIntro       from './SignatureIntro'
import SignatureElements    from './SignatureElements'
import SignatureRhythm      from './SignatureRhythm'
import SignatureStay        from './SignatureStay'
import SignatureVideo       from './SignatureVideo'
import SignatureInclusions  from './SignatureInclusions'
import SignaturePractical   from './SignaturePractical'
import SignatureQuote       from './SignatureQuote'
import SignatureEnquiryCTA  from './SignatureEnquiryCTA'
import { C } from '../../../lib/landingTypes'

// Registry — add new experiences here as data files land
const REGISTRY: Record<string, typeof iceland4e> = {
  'iceland-4e': iceland4e,
}

function resolveSlug(): string {
  const pathname = window.location.pathname
  return pathname.replace('/experiences/', '').replace(/\/$/, '')
}

export default function SignatureExperiencePage() {
  const slug = resolveSlug()
  const data = REGISTRY[slug]

  if (!data) {
    return (
      <ExperiencesLayout>
        <div
          style={{
            minHeight:      '100vh',
            background:     C.bg,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexDirection:  'column',
            gap:            16,
          }}
        >
          <p style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold }}>
            ambience.travel
          </p>
          <p style={{ fontSize: 18, color: C.muted }}>Experience not found.</p>
        </div>
      </ExperiencesLayout>
    )
  }

  const { theme, video } = data

  return (
    <ExperiencesLayout>
      <div style={{ width: '100%', overflowX: 'hidden', background: C.bg, color: C.text }}>
        <SignatureHero
          eyebrow={data.hero.eyebrow}
          title={data.hero.title}
          subtitle={data.hero.subtitle}
          pills={data.hero.pills}
          imageSrc={data.hero.imageSrc}
          imageAlt={data.hero.imageAlt}
          glassNote={data.hero.glassNote}
        />
        <SignatureIntro
          eyebrow={data.intro.eyebrow}
          title={data.intro.title}
          body={data.intro.body}
        />
        <SignatureElements
          eyebrow={data.elements.eyebrow}
          title={data.elements.title}
          body={data.elements.body}
          items={data.elements.items}
          theme={theme}
        />
        <SignatureRhythm
          eyebrow={data.rhythm.eyebrow}
          title={data.rhythm.title}
          body={data.rhythm.body}
          rows={data.rhythm.rows}
        />
        <SignatureStay
          eyebrow={data.stay.eyebrow}
          title={data.stay.title}
          body={data.stay.body}
          description={data.stay.description}
          bullets={data.stay.bullets}
          imageSrc={data.stay.imageSrc}
          imageAlt={data.stay.imageAlt}
        />
        <SignaturePractical
          eyebrow={data.practical.eyebrow}
          title={data.practical.title}
          body={data.practical.body}
          cards={data.practical.cards}
          theme={theme}
        />
        <SignatureInclusions
          eyebrow={data.inclusions.eyebrow}
          title={data.inclusions.title}
          body={data.inclusions.body}
          included={data.inclusions.included}
          excluded={data.inclusions.excluded}
        />
        <SignatureVideo
          videoSrc={video.src}
          posterSrc={video.poster}
        />
        <SignatureQuote
          eyebrow={data.quote.eyebrow}
          title={data.quote.title}
          body={data.quote.body}
          text={data.quote.text}
          attrib={data.quote.attrib}
        />
        <SignatureEnquiryCTA
          eyebrow={data.cta.eyebrow}
          title={data.cta.title}
          body={data.cta.body}
          primaryLabel={data.cta.primaryLabel}
          secondaryLabel={data.cta.secondaryLabel}
          theme={theme}
        />
      </div>
    </ExperiencesLayout>
  )
}