// useProgrammeDownload.ts — jsPDF loader + download handler for Daily Programme PDFs.
// Mirrors useBriefDownload / useDossierDownload pattern exactly.
//
// Usage:
//   const { pdfReady, pdfDownloading, handleDownloadProgramme } = useProgrammeDownload()
//   <button onClick={() => handleDownloadProgramme(data)} disabled={!pdfReady || pdfDownloading} />
//
// Last updated: S48 — initial ship.

import { useEffect, useRef, useState } from 'react'
import { exportDailyProgrammePdf, type DailyProgrammeData } from '../pdf/pdfImmerseProgramme'
import { useToast } from '../providers/ToastContext'

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

export function useImmerseProgrammePdf() {
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
        const s  = document.createElement('script')
        s.src    = src
        s.onload = () => resolve()
        s.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      })
    }

    loadScript(JSPDF_CDN)
      .then(() => setPdfReady(true))
      .catch(err => console.error('PDF library load error:', err))
  }, [])

  async function handleDownloadProgramme(data: DailyProgrammeData) {
    if (!pdfReady) {
      toastRef.current.info('PDF library is still loading. Try again in a moment.')
      return
    }
    setPdfDownloading(true)
    try {
      await exportDailyProgrammePdf(data)
    } catch (err) {
      console.error('Programme export failed:', err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toastRef.current.error(`Programme export failed: ${msg}`)
    } finally {
      setPdfDownloading(false)
    }
  }

  return { pdfReady, pdfDownloading, handleDownloadProgramme }
}