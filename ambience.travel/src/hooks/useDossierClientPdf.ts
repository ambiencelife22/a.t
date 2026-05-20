// useDossierDownload.ts — jsPDF loader + download handler for Client Dossier PDFs.
// Mirrors usePdfDownload pattern exactly. Kept separate so guide PDF state
// does not bleed into admin dossier state.
//
// Usage:
//   const { pdfReady, pdfDownloading, handleDownloadDossier } = useDossierDownload()
//   <button onClick={() => handleDownloadDossier(data)} disabled={!pdfReady || pdfDownloading} />
//
// Last updated: S45 — initial ship.

import { useEffect, useRef, useState } from 'react'
import { exportClientDossierPdf, type ClientDossierData } from '../pdf/pdfDossierClient'
import { useToast } from '../providers/ToastContext'

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

export function useDossierClientPdf() {
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
        const s       = document.createElement('script')
        s.src         = src
        s.onload      = () => resolve()
        s.onerror     = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      })
    }

    loadScript(JSPDF_CDN)
      .then(() => setPdfReady(true))
      .catch((err) => console.error('PDF library load error:', err))
  }, [])

  async function handleDownloadDossier(data: ClientDossierData) {
    if (!pdfReady) {
      toastRef.current.info('PDF library is still loading. Try again in a moment.')
      return
    }
    setPdfDownloading(true)
    try {
      await exportClientDossierPdf(data)
    } catch (err) {
      console.error('Dossier export failed:', err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toastRef.current.error(`Dossier export failed: ${msg}`)
    } finally {
      setPdfDownloading(false)
    }
  }

  return { pdfReady, pdfDownloading, handleDownloadDossier }
}