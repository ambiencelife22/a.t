// AssetPicker.tsx — modal for browsing and selecting existing images from
// the ambience-assets bucket. Returns the public URL of the selected asset.
//
// Used by: TripDossierSection (hero image picker for travel_trip_briefs),
//          and any future admin field that needs an asset URL.
//
// Design:
//   - GeoCascade folder picker (same as AssetUploader)
//   - Grid of image thumbnails from listFolderContents + getPublicUrl
//   - Click to select — calls onSelected(publicUrl) and closes
//   - Optional presetPath to skip GeoCascade (same pattern as AssetUploader)
//
// Last updated: S45 — initial ship.

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import GeoCascade, { type GeoCascadeValue } from './GeoCascade'
import { A } from '../../lib/adminTokens'

const BUCKET = 'ambience-assets'

function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: A.faint, fontFamily: A.font,
  marginBottom: 6, display: 'block',
}

const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

export type AssetPickerProps = {
  onClose:    () => void
  onSelected: (publicUrl: string) => void
  presetPath?: string
}

export default function AssetPicker({ onClose, onSelected, presetPath }: AssetPickerProps) {
  const [geo,      setGeo]      = useState<GeoCascadeValue>({ resolvedPath: null })
  const [files,    setFiles]    = useState<string[]>([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const resolvedPath = presetPath ?? geo.resolvedPath

  useEffect(() => {
    if (!resolvedPath) { setFiles([]); return }
    setLoading(true)
    // List directly without relying on listFolderContents which filters id===null
    supabase.storage
      .from('ambience-assets')
      .list(resolvedPath, { limit: 200, sortBy: { column: 'name', order: 'asc' } })
      .then(({ data }) => {
        const imgs = (data ?? [])
          .filter(item => /\.(webp|jpg|jpeg|png)$/i.test(item.name))
          .map(item => item.name)
        setFiles(imgs)
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [resolvedPath])

  function handleSelect(filename: string) {
    const fullPath  = `${resolvedPath}/${filename}`
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

        {/* Image grid */}
        {!resolvedPath && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            Select a folder to browse assets.
          </div>
        )}

        {resolvedPath && loading && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            Loading...
          </div>
        )}

        {resolvedPath && !loading && files.length === 0 && (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, textAlign: 'center', padding: '24px 0' }}>
            No images in this folder.
          </div>
        )}

        {files.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
            maxHeight: 420,
            overflowY: 'auto',
            padding: 4,
          }}>
            {files.map(filename => {
              const fullPath  = `${resolvedPath}/${filename}`
              const publicUrl = getPublicUrl(fullPath)
              const isSelected = selected === fullPath
              return (
                <div
                  key={filename}
                  onClick={() => handleSelect(filename)}
                  style={{
                    cursor:       'pointer',
                    borderRadius: 10,
                    overflow:     'hidden',
                    border:       `2px solid ${isSelected ? A.gold : A.border}`,
                    transition:   'border-color 120ms ease',
                    display:      'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ position: 'relative', paddingBottom: '66%', background: A.bgInput }}>
                    <img
                      src={publicUrl}
                      alt={filename}
                      loading='lazy'
                      style={{
                        position:   'absolute',
                        inset:      0,
                        width:      '100%',
                        height:     '100%',
                        objectFit:  'cover',
                      }}
                    />
                  </div>
                  <div style={{
                    padding:    '5px 7px',
                    fontSize:   9,
                    color:      A.faint,
                    fontFamily: A.font,
                    overflow:   'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: A.bg,
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