// ImmerseStructuredData.tsx — schema.org JSON-LD injector for /immerse/ destination pages
// Owns: head injection and cleanup of structured data script tag
// Does not own data shape, rendering, or routing
// Last updated: S12

import { useEffect } from 'react'
import { buildDestinationStructuredData } from '../../../lib/structuredImageData'
import type { ImmerseDestinationData } from '../../../lib/immerseTypes'

const SCRIPT_ID = 'immerse-structured-data'

export default function ImmerseStructuredData({ data }: { data: ImmerseDestinationData }) {
  useEffect(() => {
    // Remove any stale tag from a previous render
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.id        = SCRIPT_ID
    script.type      = 'application/ld+json'
    script.textContent = buildDestinationStructuredData(data)
    document.head.appendChild(script)

    return () => {
      const tag = document.getElementById(SCRIPT_ID)
      if (tag) tag.remove()
    }
  }, [data])

  return null
}