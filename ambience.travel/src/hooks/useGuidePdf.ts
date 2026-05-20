// usePdfDownload.ts — shared hook for guide PDF download across all guide pages.
// What it owns:
//   - jsPDF CDN load (once per page, idempotent)
//   - pdfReady state
//   - pdfDownloading state
//   - handleDownloadPdf — calls exportGuidePdf, manages loading state + toasts
//
// What it does not own:
//   - exportGuidePdf options construction (caller's job)
//   - Venue data (caller's job)
//
// Usage:
//   const { pdfReady, pdfDownloading, handleDownloadPdf } = usePdfDownload()
//   <button onClick={() => handleDownloadPdf(opts)} disabled={!pdfReady || pdfDownloading} />
//
// Last updated: S41 — extracted from DiningGuidePage. Shared across
//   DiningGuidePage + ExperiencesGuidePage (and any future guide pages).

import { useEffect, useRef, useState } from 'react'
import { exportGuidePdf, type ExportGuidePdfOptions } from '../pdf/pdfGuide'
import { useToast } from '../lib/ToastContext'

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

export function useGuidePdf() {
  const { toast }   = useToast()
  const toastRef    = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const [pdfReady,       setPdfReady]       = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)

  useEffect(() => {
    const w = window as any
    if (w.jspdf?.jsPDF) { setPdfReady(true); return }

    function loadScript(src: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
        if (existing) {
          if ((window as any).jspdf?.jsPDF) { resolve(); return }
          existing.addEventListener('load', () => resolve())
          existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
          return
        }
        const s = document.createElement('script')
        s.src     = src
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      })
    }

    loadScript(JSPDF_CDN)
      .then(() => setPdfReady(true))
      .catch((err) => { console.error('PDF library load error:', err) })
  }, [])

  async function handleDownloadPdf(opts: ExportGuidePdfOptions) {
    if (!pdfReady) {
      toastRef.current.info('PDF library is still loading. Try again in a moment.')
      return
    }
    if (opts.venues.length === 0) {
      toastRef.current.info('No venues to export yet.')
      return
    }
    setPdfDownloading(true)
    try {
      await exportGuidePdf(opts)
    } catch (err) {
      console.error('PDF export failed:', err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toastRef.current.error(`PDF export failed: ${msg}`)
    } finally {
      setPdfDownloading(false)
    }
  }

  return { pdfReady, pdfDownloading, handleDownloadPdf }
}