// useBriefDownload.ts — jsPDF loader + download handler for Confirmation Brief PDFs.
// Mirrors useDossierDownload pattern. Kept separate so brief state does not
// bleed into dossier or guide PDF state.
//
// Usage:
//   const { pdfReady, pdfDownloading, handleDownloadBrief } = useBriefDownload()
//   <button onClick={() => handleDownloadBrief(data)} disabled={!pdfReady || pdfDownloading} />
//
// Last updated: S45 — initial ship.

import { useEffect, useRef, useState } from 'react'
import { exportConfirmationBriefPdf, type ConfirmationBriefData } from './confirmationBriefPdf'
import { useToast } from './ToastContext'

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

export function useBriefDownload() {
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

  async function handleDownloadBrief(data: ConfirmationBriefData) {
    if (!pdfReady) { toastRef.current.info('PDF library is still loading. Try again in a moment.'); return }
    setPdfDownloading(true)
    try {
      await exportConfirmationBriefPdf(data)
    } catch (err) {
      console.error('Brief export failed:', err)
      toastRef.current.error(`Brief export failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setPdfDownloading(false)
    }
  }

  return { pdfReady, pdfDownloading, handleDownloadBrief }
}