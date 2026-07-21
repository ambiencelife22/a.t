// AssetPicker.tsx - modal for browsing and selecting existing images from
// the ambience-assets bucket. Returns the public URL of the selected asset.
//
// Used by: BriefEditorPage (hero + room image pickers).
//
// Design:
//   - GeoCascade folder picker when no presetPath
//   - When presetPath provided: lists that folder directly
//   - Handles up to TWO levels of subfolders before images:
//       e.g. nyc/ → accom/ → four-seasons/ → image.webp
//   - Root-level images shown under a 'Hero' tab alongside subfolder tabs
//   - Click to select - calls onSelected(publicUrl) and closes
//
// Last updated: S49 - root-level images (hero images) now appear under a
//   'Hero' tab when the folder also contains subfolders. Previously the
//   category tab strip appeared but root images were never reachable.
// Prior: S47 - two-level subfolder support.
// Prior: S46 - single subfolder level.
// Prior: S45 - initial ship.

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import GeoCascade, { type GeoCascadeValue } from './GeoCascade'
import { A } from '../../tokens/tokensAdmin'

const BUCKET = 'ambience-assets'

function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function isImageFile(name: string): boolean {
  return /\.(webp|jpg|jpeg|png)$/i.test(name)
}

function isFolder(item: { id: string | null }): boolean {
  return item.id === null
}

async function listPath(path: string) {
  const { data } = await supabase.storage
    .from(BUCKET)
    .list(path, { limit: 200, sortBy: { column: 'name', order: 'asc' } })
  return data ?? []
}

const HERO_TAB = '__hero__'

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
  const [geo,       setGeo]       = useState<GeoCascadeValue>({ resolvedPath: null })

  // Level 1 subfolders (e.g. accom, dining, experiences, hotel)
  const [level1Dirs,       setLevel1Dirs]       = useState<string[]>([])
  const [level1RootImages, setLevel1RootImages] = useState<string[]>([])  // images at root alongside subdirs
  const [level1Sel,        setLevel1Sel]        = useState<string>('')

  // Level 2 subfolders (e.g. four-seasons, peninsula)
  const [level2Dirs, setLevel2Dirs] = useState<string[]>([])
  const [level2Sel,  setLevel2Sel]  = useState<string>('')

  const [files,    setFiles]    = useState<string[]>([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const basePath = presetPath ?? geo.resolvedPath

  // ── Level 1: list basePath ────────────────────────────────────────────────
  useEffect(() => {
    if (!basePath) {
      setLevel1Dirs([]); setLevel1RootImages([]); setLevel1Sel('')
      setLevel2Dirs([]); setLevel2Sel(''); setFiles([])
      return
    }
    setLoading(true)
    setLevel1Dirs([]); setLevel1RootImages([]); setLevel1Sel('')
    setLevel2Dirs([]); setLevel2Sel(''); setFiles([])

    listPath(basePath).then(items => {
      const dirs = items.filter(isFolder).map(i => i.name)
      const imgs = items.filter(i => isImageFile(i.name)).map(i => i.name)

      if (dirs.length > 0) {
        setLevel1Dirs(dirs)
        setLevel1RootImages(imgs)  // may be empty - that's fine
        // If there are root images, auto-select the Hero tab
        if (imgs.length > 0) {
          setLevel1Sel(HERO_TAB)
          setFiles(imgs)
        }
      }
      if (dirs.length === 0) {
        setFiles(imgs)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [basePath])

  // ── Level 2: list basePath/level1Sel ─────────────────────────────────────
  useEffect(() => {
    if (!basePath || !level1Sel || level1Sel === HERO_TAB) {
      if (level1Sel === HERO_TAB) {
        setLevel2Dirs([]); setLevel2Sel(''); setFiles(level1RootImages)
      }
      if (level1Sel !== HERO_TAB) {
        setLevel2Dirs([]); setLevel2Sel(''); setFiles([])
      }
      return
    }
    setLoading(true)
    setLevel2Dirs([]); setLevel2Sel(''); setFiles([])

    listPath(`${basePath}/${level1Sel}`).then(items => {
      const dirs = items.filter(isFolder).map(i => i.name)
      const imgs = items.filter(i => isImageFile(i.name)).map(i => i.name)

      if (dirs.length > 0) {
        setLevel2Dirs(dirs)
      }
      if (dirs.length === 0) {
        setFiles(imgs)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [basePath, level1Sel])

  // ── Level 3 (images): list basePath/level1Sel/level2Sel ──────────────────
  useEffect(() => {
    if (!basePath || !level1Sel || level1Sel === HERO_TAB || level2Dirs.length === 0 || !level2Sel) return
    setLoading(true)
    setFiles([])

    listPath(`${basePath}/${level1Sel}/${level2Sel}`).then(items => {
      setFiles(items.filter(i => isImageFile(i.name)).map(i => i.name))
    }).catch(() => setFiles([])).finally(() => setLoading(false))
  }, [basePath, level1Sel, level2Sel, level2Dirs.length])

  // ── Active path for image resolution ─────────────────────────────────────
  const activePath = (() => {
    if (!basePath) return null
    if (level1Dirs.length === 0) return basePath                              // no subfolders
    if (!level1Sel) return null                                               // waiting for L1 pick
    if (level1Sel === HERO_TAB) return basePath                              // root images
    if (level2Dirs.length === 0) return `${basePath}/${level1Sel}`           // L1 has images directly
    if (!level2Sel) return null                                               // waiting for L2 pick
    return `${basePath}/${level1Sel}/${level2Sel}`                           // L2 has images
  })()

  function handleSelect(filename: string) {
    if (!activePath) return
    const fullPath  = `${activePath}/${filename}`
    const publicUrl = getPublicUrl(fullPath)
    setSelected(fullPath)
    onSelected(publicUrl)
    setTimeout(onClose, 150)
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  // Build tab list - Hero tab first if root images exist
  const allTabs = [
    ...(level1RootImages.length > 0 ? [HERO_TAB] : []),
    ...level1Dirs,
  ]

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

        {/* Folder display */}
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

        {/* Level 1 - tab strip (Hero tab + subfolders) */}
        {allTabs.length > 0 && (
          <div>
            <label style={labelStyle}>Category</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allTabs.map(d => (
                <button
                  key={d}
                  onClick={() => { setLevel1Sel(d); setLevel2Sel('') }}
                  style={{
                    fontFamily: A.font, fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'capitalize' as const,
                    border: `1px solid ${level1Sel === d ? A.gold : A.border}`,
                    borderRadius: 6, padding: '5px 14px', cursor: 'pointer',
                    background: level1Sel === d ? `${A.gold}18` : 'transparent',
                    color: level1Sel === d ? A.gold : A.faint,
                    transition: 'all 120ms ease',
                  }}
                >
                  {d === HERO_TAB ? 'Hero' : capitalize(d)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Level 2 - dropdown */}
        {level2Dirs.length > 0 && (
          <div>
            <label style={labelStyle}>Hotel / Venue</label>
            <select
              style={selectStyle}
              value={level2Sel}
              onChange={e => setLevel2Sel(e.target.value)}
            >
              <option value=''>- Select -</option>
              {level2Dirs.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        )}

        {/* States */}
        {!activePath && !loading && basePath && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            {allTabs.length > 0 ? 'Select a category above.' : 'No images found.'}
          </div>
        )}

        {!basePath && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            Select a folder to browse assets.
          </div>
        )}

        {loading && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            Loading...
          </div>
        )}

        {activePath && !loading && files.length === 0 && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            No images in this folder.
          </div>
        )}

        {/* Image grid */}
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