// AssetPicker.tsx — modal for browsing and selecting existing images from
// the ambience-assets bucket. Returns the public URL of the selected asset.
//
// Used by: BriefEditorPage (hero + room image pickers).
//
// Design:
//   - GeoCascade folder picker (same as AssetUploader) when no presetPath
//   - When presetPath provided: lists that folder directly
//   - If folder contains subfolders (no image extension), shows subfolder
//     picker first, then lists images inside selected subfolder
//   - Click to select — calls onSelected(publicUrl) and closes
//
// Last updated: S46 — subfolder browsing when presetPath contains folders
//   not images (e.g. accom/ contains hotel subfolders). Pre-selects first
//   subfolder automatically.
// Prior: S45 — initial ship.

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import GeoCascade, { type GeoCascadeValue } from './GeoCascade'
import { A } from '../../lib/adminTokens'

const BUCKET = 'ambience-assets'

function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function isImageFile(name: string): boolean {
  return /\.(webp|jpg|jpeg|png)$/i.test(name)
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: A.faint, fontFamily: A.font,
  marginBottom: 6, display: 'block',
}

const selectStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: A.text,
  fontFamily: A.font, outline: 'none', boxSizing: 'border-box' as const, cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

export type AssetPickerProps = {
  onClose:     () => void
  onSelected:  (publicUrl: string) => void
  presetPath?: string
}

export default function AssetPicker({ onClose, onSelected, presetPath }: AssetPickerProps) {
  const [geo,          setGeo]          = useState<GeoCascadeValue>({ resolvedPath: null })
  const [subfolders,   setSubfolders]   = useState<string[]>([])
  const [subfolder,    setSubfolder]    = useState<string>('')
  const [files,        setFiles]        = useState<string[]>([])
  const [loading,      setLoading]      = useState(false)
  const [selected,     setSelected]     = useState<string | null>(null)

  const basePath    = presetPath ?? geo.resolvedPath
  const activePath  = subfolders.length > 0 ? (subfolder ? `${basePath}/${subfolder}` : null) : basePath

  // When basePath changes, list it to detect subfolders vs images
  useEffect(() => {
    if (!basePath) { setSubfolders([]); setSubfolder(''); setFiles([]); return }
    setLoading(true)
    setSubfolders([]); setSubfolder(''); setFiles([])
    supabase.storage
      .from(BUCKET)
      .list(basePath, { limit: 200, sortBy: { column: 'name', order: 'asc' } })
      .then(({ data }) => {
        const items = data ?? []
        const imgs  = items.filter(i => isImageFile(i.name)).map(i => i.name)
        // Folders have id === null in Supabase Storage list response
        const dirs  = items.filter(i => i.id === null).map(i => i.name)
        if (dirs.length > 0) {
          setSubfolders(dirs)
          setSubfolder(dirs[0]) // auto-select first subfolder
        } else {
          setFiles(imgs)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [basePath])

  // When subfolder changes, list its images
  useEffect(() => {
    if (!basePath || subfolders.length === 0 || !subfolder) { return }
    setLoading(true)
    setFiles([])
    supabase.storage
      .from(BUCKET)
      .list(`${basePath}/${subfolder}`, { limit: 200, sortBy: { column: 'name', order: 'asc' } })
      .then(({ data }) => {
        const imgs = (data ?? []).filter(i => isImageFile(i.name)).map(i => i.name)
        setFiles(imgs)
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [basePath, subfolder, subfolders.length])

  function handleSelect(filename: string) {
    const fullPath  = `${activePath}/${filename}`
    const publicUrl = getPublicUrl(fullPath)
    setSelected(fullPath)
    onSelected(publicUrl)
    setTimeout(onClose, 150)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 20px', overflowY: 'auto',
    }}>
      <div style={{
        background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 20,
        padding: 28, width: '100%', maxWidth: 760,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, fontWeight: 700, marginBottom: 4 }}>
              Asset Library
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              Select Image
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Folder picker */}
        {presetPath ? (
          <div>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Folder</div>
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: A.bgInput, border: `1px solid ${A.border}`,
              fontSize: 12, fontFamily: "'DM Mono', monospace", color: A.muted,
            }}>
              {activePath ?? presetPath}
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
                {activePath ?? geo.resolvedPath}
              </div>
            )}
          </div>
        )}

        {/* Subfolder picker — shown when basePath contains folders not images */}
        {subfolders.length > 0 && (
          <div>
            <label style={labelStyle}>Hotel</label>
            <select
              style={selectStyle}
              value={subfolder}
              onChange={e => setSubfolder(e.target.value)}
            >
              {subfolders.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        )}

        {/* Image grid */}
        {!activePath && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            Select a folder to browse assets.
          </div>
        )}

        {activePath && loading && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            Loading...
          </div>
        )}

        {activePath && !loading && files.length === 0 && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            No images in this folder.
          </div>
        )}

        {files.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10, maxHeight: 420, overflowY: 'auto', padding: 4,
          }}>
            {files.map(filename => {
              const fullPath  = `${activePath}/${filename}`
              const publicUrl = getPublicUrl(fullPath)
              const isSelected = selected === fullPath
              return (
                <div
                  key={filename}
                  onClick={() => handleSelect(filename)}
                  style={{
                    cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
                    border: `2px solid ${isSelected ? A.gold : A.border}`,
                    transition: 'border-color 120ms ease',
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{ position: 'relative', paddingBottom: '66%', background: A.bgInput }}>
                    <img
                      src={publicUrl} alt={filename} loading='lazy'
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{
                    padding: '5px 7px', fontSize: 9, color: A.faint, fontFamily: A.font,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: A.bg,
                  }}>
                    {filename}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${A.border}`, paddingTop: 14 }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
        </div>
      </div>
    </div>
  )
}