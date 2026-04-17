import { supabase } from './supabase'
import type { ImmerseDestinationData } from './immerseTypes'

type ImmerseBottomContent = {
  pricingNotesHeading?: string
  pricingNotesTitle?: string
  pricingNotes: string[]
}

type GetImmerseBottomContentArgs = {
  scope: string
  destinationSlug: string
  fallbackHeading?: string
  fallbackTitle?: string
  fallbackNotes?: string[]
}

const LOCAL_BOTTOM_CONTENT: Record<string, ImmerseBottomContent> = {
  'public:new-york': {
    pricingNotesHeading: 'Planning Notes',
    pricingNotesTitle: 'Key Considerations',
    pricingNotes: [
      'All rates are indicative and subject to availability at the time of booking.',
      'Preferred partner amenities are included where applicable, typically featuring daily breakfast, room upgrades, and hotel credits.',
      'Flexible cancellation policies are standard across most options, typically allowing changes or cancellation up to 48–72 hours prior to arrival.',
      'Final pricing will be reconfirmed based on exact dates and room category at the time of booking.',
    ],
  },

  'gCyRNp7NjF9:new-york': {
    pricingNotesHeading: 'Planning Notes For Yazeed',
    pricingNotesTitle: 'Key Considerations',
    pricingNotes: [
      'All rates include daily breakfast and a flexible cancellation policy, typically up to 72 hours prior to arrival.',
      'Preferred partner amenities have been prioritized where available, adding further value and comfort to the stay.',
      'Room categories and pricing shown reflect current availability for your travel window and may adjust slightly at time of confirmation.',
      'This New York segment has been curated to balance energy, privacy, and ease throughout the stay.',
    ],
  },

  'public:st-barths': {
    pricingNotesHeading: 'Planning Notes',
    pricingNotesTitle: 'Key Considerations',
    pricingNotes: [
      'Rates are indicative and subject to availability at the time of booking.',
      'Breakfast and preferred partner amenities are included where applicable.',
      'Cancellation terms vary by property, though flexible options have been prioritized wherever possible.',
      'Final pricing will be confirmed based on exact stay dates, room category, and availability.',
    ],
  },

  'gCyRNp7NjF9:st-barths': {
    pricingNotesHeading: 'Planning Notes For Yazeed',
    pricingNotesTitle: 'Key Considerations',
    pricingNotes: [
      'Rates shown include daily breakfast and selected preferred partner enhancements where applicable.',
      'Flexible cancellation policies have been prioritized throughout this segment wherever available.',
      'Pricing reflects the current travel window and may adjust slightly at the time of final confirmation.',
      'This St. Barths stay has been designed around privacy, ease, and a softer daily rhythm.',
    ],
  },

  'public:nordic-winter': {
    pricingNotesHeading: 'Planning Notes',
    pricingNotesTitle: 'Key Considerations',
    pricingNotes: [
      'Rates are indicative and subject to seasonal availability at the time of booking.',
      'Breakfast and selected partner inclusions are reflected where applicable.',
      'Flexible cancellation terms have been prioritized, though exact policies may vary by property.',
      'Final room categories and pricing will be reconfirmed based on exact dates and winter conditions.',
    ],
  },

  'gCyRNp7NjF9:nordic-winter': {
    pricingNotesHeading: 'Planning Notes For Yazeed',
    pricingNotesTitle: 'Key Considerations',
    pricingNotes: [
      'Rates shown include daily breakfast and flexible terms wherever available across the journey.',
      'Winter availability, seasonal access, and room category selection may influence final pricing at time of confirmation.',
      'Preferred partner enhancements have been prioritized where applicable to add further comfort to the stay.',
      'This segment has been structured around stillness, warmth, and seamless transitions through the winter landscape.',
    ],
  },

  '*:*': {
    pricingNotesHeading: 'Booking Notes',
    pricingNotesTitle: 'What to know',
    pricingNotes: [
      'Rates are indicative and subject to availability at the time of booking.',
      'Breakfast and preferred partner amenities are included where applicable.',
      'Flexible terms have been prioritized wherever possible, though final cancellation policies vary by property.',
      'Final pricing will be confirmed based on exact dates, room category, and availability at the time of booking.',
    ],
  },
}

function getLocalBottomContent(
  scope: string,
  destinationSlug: string,
  fallbackHeading?: string,
  fallbackTitle?: string,
  fallbackNotes: string[] = []
): ImmerseBottomContent {
  const matched =
    LOCAL_BOTTOM_CONTENT[`${scope}:${destinationSlug}`] ||
    LOCAL_BOTTOM_CONTENT[`public:${destinationSlug}`] ||
    LOCAL_BOTTOM_CONTENT['*:*']

  return {
    pricingNotesHeading: matched.pricingNotesHeading ?? fallbackHeading ?? 'Booking Notes',
    pricingNotesTitle: matched.pricingNotesTitle ?? fallbackTitle ?? 'What to know',
    pricingNotes: matched.pricingNotes?.length ? matched.pricingNotes : fallbackNotes,
  }
}

export async function getImmerseBottomContent({
  scope,
  destinationSlug,
  fallbackHeading,
  fallbackTitle,
  fallbackNotes = [],
}: GetImmerseBottomContentArgs): Promise<ImmerseBottomContent> {
  try {
    const { data, error } = await supabase
      .from('immerse_bottom_notes')
      .select('pricing_notes_heading, pricing_notes_title, notes')
      .eq('scope', scope)
      .eq('destination_slug', destinationSlug)
      .maybeSingle()

    if (error) {
      console.error('getImmerseBottomContent: db query failed', error)
      return getLocalBottomContent(
        scope,
        destinationSlug,
        fallbackHeading,
        fallbackTitle,
        fallbackNotes
      )
    }

    if (data) {
      return {
        pricingNotesHeading:
          data.pricing_notes_heading ??
          getLocalBottomContent(scope, destinationSlug, fallbackHeading, fallbackTitle, fallbackNotes).pricingNotesHeading,
        pricingNotesTitle:
          data.pricing_notes_title ??
          getLocalBottomContent(scope, destinationSlug, fallbackHeading, fallbackTitle, fallbackNotes).pricingNotesTitle,
        pricingNotes:
          Array.isArray(data.notes) && data.notes.length > 0
            ? data.notes
            : getLocalBottomContent(scope, destinationSlug, fallbackHeading, fallbackTitle, fallbackNotes).pricingNotes,
      }
    }

    return getLocalBottomContent(
      scope,
      destinationSlug,
      fallbackHeading,
      fallbackTitle,
      fallbackNotes
    )
  } catch (err) {
    console.error('getImmerseBottomContent: unexpected error', err)
    return getLocalBottomContent(
      scope,
      destinationSlug,
      fallbackHeading,
      fallbackTitle,
      fallbackNotes
    )
  }
}