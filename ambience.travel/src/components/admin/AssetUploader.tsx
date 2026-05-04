// AssetUploader.tsx — modal for uploading images (webp) and floorplan PDFs
// to the ambience-assets bucket. Composed of GeoCascade folder picker +
// filename editor + upload pipeline.
//
// Modes:
//   - 'image'     — converts to webp via canvas, quality 0.85
//   - 'floorplan' — PDF passthrough, no conversion
//
// presetPath mode (S36):
//   When presetPath is provided, GeoCascade is hidden and uploads go
//   directly to that path. Used by destination-scoped flows (Library /
//   Dining for a specific destination).
//
// Last updated: S36 — Added presetPath prop. When set, GeoCascade is
//   hidden and the resolved path is used directly.
// Prior: S33B

import { useEffect, useState } from 'react'
import {
  uploadImageAsWebp,
  uploadPdf,
  listFolderContents,
  detectCollision,
  type UploadResult,
} from '../../lib/adminAssetQueries'
import GeoCascade, { type GeoCascadeValue } from './GeoCascade'
import { A } from '../../lib/adminTokens'

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 32, right: 32, zIndex: 10001,
      padding: '12px 20px', borderRadius: 12,
      background: type === 'success' ? '#1a2e1a' : '#2e1a1a',
      border: `1px solid ${type === 'success' ? A.positive + '50' : A.danger + '50'}`,
      color: type === 'success' ? A.positive : A.danger,
      fontSize: 13, fontFamily: A.font, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {message}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: A.faint, fontFamily: A.font,
  marginBottom: 6, display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput,
  border: `1px solid ${A.border}`, borderRadius: 10,
  padding: '10px 14px', fontSize: 13, color: A.text,
  fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
}

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "'DM Mono', monospace",
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'rgba(216,181,106,0.12)',
  color: A.gold, border: `1px solid rgba(216,181,106,0.30)`,
  borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: A.font,
  cursor: 'pointer', letterSpacing: '0.04em',
}

const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  ...btnGhost,
  color: A.danger,
  borderColor: 'rgba(239,68,68,0.3)',
}

export type AssetUploaderProps = {
  mode:        'image' | 'floorplan'
  onClose:     () => void
  onUploaded:  (result: UploadResult) => void
  /**
   * If provided, the GeoCascade picker is hidden and uploads target this
   * path directly. The path is shown read-only above the file picker.
   */
  presetPath?: string
}

export default function AssetUploader({ mode, onClose, onUploaded, presetPath }: AssetUploaderProps) {
  const [geo, setGeo]                       = useState<GeoCascadeValue>({ resolvedPath: null })
  const [file, setFile]                     = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null)
  const [filename, setFilename]             = useState('')
  const [folderContents, setFolderContents] = useState<string[]>([])
  const [collision, setCollision]           = useState<{ status: 'ok' | 'collision'; nextNumberedFilename: string }>({ status: 'ok', nextNumberedFilename: '' })
  const [uploading, setUploading]           = useState(false)
  const [toast, setToast]                   = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Resolved path: presetPath (if provided) wins; otherwise from GeoCascade.
  const resolvedPath = presetPath ?? geo.resolvedPath

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  function handleFile(f: File | null) {
    setFile(f)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }

    if (!f) return

    if (mode === 'image') {
      setPreviewUrl(URL.createObjectURL(f))
    }

    const base = f.name.replace(/\.[^.]+$/, '')
    setFilename(base)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!resolvedPath) {
      setFolderContents([])
      return
    }
    listFolderContents(resolvedPath)
      .then(setFolderContents)
      .catch(() => setFolderContents([]))
  }, [resolvedPath])

  useEffect(() => {
    if (!filename) {
      setCollision({ status: 'ok', nextNumberedFilename: '' })
      return
    }
    const ext = mode === 'image' ? 'webp' : 'pdf'
    setCollision(detectCollision(filename, folderContents, ext))
  }, [filename, folderContents, mode])

  async function doUpload(opts: { upsert: boolean }) {
    if (!file)             { showToast('Select a file first.',  'error'); return }
    if (!resolvedPath)     { showToast('Pick a folder first.',  'error'); return }
    if (!filename.trim())  { showToast('Filename is required.', 'error'); return }

    if (mode === 'floorplan' && file.type !== 'application/pdf') {
      showToast('Floorplan upload requires a PDF.', 'error')
      return
    }
    if (mode === 'image' && !file.type.startsWith('image/')) {
      showToast('Image upload requires an image file.', 'error')
      return
    }

    setUploading(true)
    try {
      let result: UploadResult
      if (mode === 'image') {
        result = await uploadImageAsWebp(file, resolvedPath, filename.trim(), { upsert: opts.upsert })
      }
      if (mode === 'floorplan') {
        result = await uploadPdf(file, resolvedPath, filename.trim(), { upsert: opts.upsert })
      }
      // @ts-expect-error — one of the branches always assigns
      onUploaded(result)
      showToast('Uploaded.', 'success')
      setTimeout(onClose, 600)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Upload failed: ${message}`, 'error')
    }
    setUploading(false)
  }

  const acceptAttr = mode === 'image' ? 'image/*' : 'application/pdf'
  const titleEyebrow = mode === 'image' ? 'Upload Image (WebP)' : 'Upload Floorplan (PDF)'
  const ext = mode === 'image' ? 'webp' : 'pdf'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 20px', overflowY: 'auto',
    }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div style={{
        background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 20,
        padding: 28, width: '100%', maxWidth: 720,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, fontWeight: 700, marginBottom: 4 }}>
              Asset Uploader
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {titleEyebrow}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Folder: GeoCascade if no preset, read-only chip if preset */}
        {presetPath ? (
          <div>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Folder</div>
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: A.bgInput, border: `1px solid ${A.border}`,
              fontSize: 12, fontFamily: "'DM Mono', monospace", color: A.muted,
            }}>
              {presetPath}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Folder</div>
            <GeoCascade onChange={setGeo} />
            {geo.resolvedPath && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 8,
                background: A.bgInput, border: `1px solid ${A.border}`,
                fontSize: 12, fontFamily: "'DM Mono', monospace", color: A.muted,
              }}>
                {geo.resolvedPath}
              </div>
            )}
          </div>
        )}

        <div>
          <label style={labelStyle}>{mode === 'image' ? 'Image file' : 'PDF file'}</label>
          <input
            type='file'
            accept={acceptAttr}
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          />
        </div>

        {mode === 'image' && previewUrl && (
          <div>
            <label style={labelStyle}>Preview (will convert to webp)</label>
            <div style={{
              padding: 8, background: A.bgInput, borderRadius: 10,
              border: `1px solid ${A.border}`, textAlign: 'center',
            }}>
              <img
                src={previewUrl}
                alt='preview'
                style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 6 }}
              />
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>Filename</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ ...monoInputStyle, flex: 1 }}
              value={filename}
              onChange={e => setFilename(e.target.value)}
              placeholder='e.g. cbparis-3'
            />
            <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: A.faint }}>
              .{ext}
            </span>
          </div>
          {collision.status === 'collision' && (
            <div style={{ marginTop: 8, fontSize: 12, color: A.danger, fontFamily: A.font }}>
              ⚠ {filename}.{ext} already exists in this folder.
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', gap: 10, paddingTop: 8,
          borderTop: `1px solid ${A.border}`, flexWrap: 'wrap',
        }}>
          {collision.status === 'ok' && (
            <button
              onClick={() => doUpload({ upsert: false })}
              disabled={uploading || !file || !resolvedPath || !filename.trim()}
              style={{ ...btnPrimary, opacity: uploading ? 0.5 : 1 }}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          )}
          {collision.status === 'collision' && (
            <>
              <button
                onClick={() => setFilename(collision.nextNumberedFilename)}
                disabled={uploading}
                style={btnPrimary}
              >
                Rename to {collision.nextNumberedFilename}
              </button>
              <button
                onClick={() => doUpload({ upsert: true })}
                disabled={uploading || !file || !resolvedPath}
                style={{ ...btnDanger, opacity: uploading ? 0.5 : 1 }}
              >
                {uploading ? 'Uploading…' : 'Overwrite existing'}
              </button>
            </>
          )}
          <button onClick={onClose} disabled={uploading} style={btnGhost}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}