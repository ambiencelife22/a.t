// ImageFieldWithUploader.tsx — text input + upload button for image fields
// Drop-in replacement for raw <input value={src} onChange={...} /> on
// image_src / floorplan_src fields throughout admin. Paste-URL still works
// (the input is editable directly); the "Upload" button opens AssetUploader
// for the alternative path.
//
// Last updated: S36 — Added optional presetPath prop. When provided,
//   AssetUploader hides GeoCascade and uploads directly to the resolved
//   destination folder (e.g. immerse/na/usa/ny/nyc/dining for NYC dining).
//   When omitted, AssetUploader behaves as before (full GeoCascade picker).
// Prior: S33B

import { useState } from 'react'
import AssetUploader from './AssetUploader'
import { A } from '../../lib/adminTokens'

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   A.bgInput,
  border:       `1px solid ${A.border}`,
  borderRadius: 10,
  padding:      '10px 14px',
  fontSize:     13,
  color:        A.text,
  fontFamily:   A.font,
  outline:      'none',
  boxSizing:    'border-box',
}

const btnGhost: React.CSSProperties = {
  padding:        '7px 14px',
  background:     'transparent',
  color:          A.gold,
  border:         `1px solid ${A.borderGold}`,
  borderRadius:   10,
  fontSize:       12,
  fontWeight:     600,
  fontFamily:     A.font,
  cursor:         'pointer',
  whiteSpace:     'nowrap',
}

const PUBLIC_URL_PREFIX =
  'https://rjobcbpnhymuczjhqzmh.supabase.co/storage/v1/object/public/ambience-assets/'

export default function ImageFieldWithUploader({
  value,
  onChange,
  mode = 'image',
  showPreview = true,
  presetPath = null,
}: {
  value:        string | null
  onChange:     (next: string | null) => void
  mode?:        'image' | 'floorplan'
  showPreview?: boolean
  /**
   * If provided, AssetUploader uploads directly to this path with no
   * GeoCascade picker. Pass null when path can't be resolved (destination
   * has no storage_path) — the upload button is disabled with a hint.
   */
  presetPath?: string | null
}) {
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const presetMode = presetPath !== undefined && presetPath !== null
  const presetMissing = presetPath === null && uploaderOpen === false && false
  // presetPath === null while parent expects scope → uploader disabled
  // presetPath === undefined → legacy free-cascade mode

  function handleUploaded(result: { path: string; publicUrl: string }) {
    onChange(result.path)
  }

  const previewSrc = (() => {
    if (!value) return null
    if (value.startsWith('http://') || value.startsWith('https://')) return value
    return `${PUBLIC_URL_PREFIX}${value}`
  })()

  const isImage = mode === 'image'

  // Upload button is disabled when caller passed presetPath=null explicitly
  // (destination has no storage_path configured yet).
  const uploadDisabled = presetPath === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", flex: 1 }}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder={isImage ? 'immerse/.../<file>.webp' : 'immerse/.../<file>.pdf'}
        />
        <button
          onClick={() => { if (!uploadDisabled) setUploaderOpen(true) }}
          style={{ ...btnGhost, opacity: uploadDisabled ? 0.4 : 1, cursor: uploadDisabled ? 'not-allowed' : 'pointer' }}
          title={uploadDisabled ? 'Destination not loaded yet — paste a URL or set storage_path on the destination first' : ''}
          disabled={uploadDisabled}
        >
          {isImage ? '↑ Upload' : '↑ Upload PDF'}
        </button>
      </div>

      {uploadDisabled && (
        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>
          Destination not loaded yet — upload disabled. Paste a URL above instead.
        </div>
      )}

      {showPreview && isImage && previewSrc && (
        <div style={{
          alignSelf:    'flex-start',
          padding:      4,
          background:   A.bgInput,
          border:       `1px solid ${A.border}`,
          borderRadius: 8,
          maxWidth:     220,
        }}>
          <img
            src={previewSrc}
            alt='current'
            style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 4, display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {showPreview && !isImage && previewSrc && (
        <a
          href={previewSrc}
          target='_blank'
          rel='noopener noreferrer'
          style={{
            alignSelf:  'flex-start',
            fontSize:   11,
            color:      A.gold,
            fontFamily: A.font,
            textDecoration: 'none',
            padding:    '6px 10px',
            borderRadius: 6,
            background: 'rgba(216,181,106,0.06)',
            border: `1px solid ${A.borderGold}`,
          }}
        >
          ↗ View PDF
        </a>
      )}

      {uploaderOpen && (
        <AssetUploader
          mode={mode}
          presetPath={presetMode ? presetPath : undefined}
          onClose={() => setUploaderOpen(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  )
}