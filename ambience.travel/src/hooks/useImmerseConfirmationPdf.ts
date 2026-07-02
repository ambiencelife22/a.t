// useImmerseConfirmationPdf.ts — jsPDF loader + download handlers for
// Confirmation Brief and Trip Brief PDFs.
//
// Exports two handlers from one hook so both PDF types share a single
// jsPDF load lifecycle:
//   handleDownloadBrief(data)        — Trip Confirmation PDF
//   handleDownloadTripBrief(data)    — Trip Brief PDF (structured summary)
//
// Last updated: S49 — added handleDownloadTripBrief for Trip Brief tab.
//   Both handlers share pdfReady / pdfDownloading state from one jsPDF load.
// Prior: S45 — initial ship.

import { useEffect, useRef, useState } from 'react'
import { exportConfirmationBriefPdf, type ConfirmationBriefData } from '../pdf/pdfImmerseConfirmation'
import { exportTripBriefPdf, type TripBriefPdfData } from '../pdf/pdfImmerseBrief'
import { useToast } from '../providers/ToastContext'

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

export function useImmerseConfirmationPdf() {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
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
        s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      })
    }

    loadScript(JSPDF_CDN)
      .then(() => setPdfReady(true))
      .catch(err => console.error('PDF library load error:', err))
  }, [])

  // Confirmation Brief PDF — accommodation cards + flights (card layout)
  async function handleDownloadBrief(data: ConfirmationBriefData, branding: import('../pdf/pdfShared').ExportBranding = 'ambience') {
    if (!pdfReady) { toastRef.current.info('PDF library is still loading. Try again in a moment.'); return }
    setPdfDownloading(true)
    try {
      await exportConfirmationBriefPdf(data, branding)
    } catch (err) {
      console.error('Confirmation PDF export failed:', err)
      toastRef.current.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setPdfDownloading(false)
    }
  }

  // Trip Brief PDF — structured summary (overview table + sections)
  async function handleDownloadTripBrief(data: TripBriefPdfData, branding: import('../pdf/pdfShared').ExportBranding = 'ambience') {
    if (!pdfReady) { toastRef.current.info('PDF library is still loading. Try again in a moment.'); return }
    setPdfDownloading(true)
    try {
      await exportTripBriefPdf(data, branding)
    } catch (err) {
      console.error('Trip Brief PDF export failed:', err)
      toastRef.current.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setPdfDownloading(false)
    }
  }

  return { pdfReady, pdfDownloading, handleDownloadBrief, handleDownloadTripBrief }
}