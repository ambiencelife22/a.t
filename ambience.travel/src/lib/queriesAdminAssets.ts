// adminAssetQueries.ts — Supabase Storage writes for AmbienceAdmin
// Owns:    webp conversion (client-side, canvas), image upload, PDF upload,
//          folder listing for collision detection, asset deletion.
// Not owned: storage path derivation (see storagePath.ts), upload UI
//            (see AssetUploader.tsx), engagement-side wiring (see
//            EngagementDetailTab.tsx).
//
// Design notes:
//   - All writes go through supabase.storage — never direct fetch().
//   - WebP conversion happens client-side via <canvas>.toBlob(). No server
//     roundtrip for the conversion itself; only the final webp gets POSTed.
//   - Quality default 0.85 — visually lossless for photo content at typical
//     hero/gallery sizes. Adjustable per call.
//   - Returns relative paths (no bucket prefix). Caller composes the full
//     public URL via the bucket's public-read pattern when needed.
//
// Last updated: S33B

import { supabase } from './supabase'

const BUCKET = 'ambience-assets'

// ── Upload result ─────────────────────────────────────────────────────────────

export type UploadResult = {
  path:      string   // relative path within bucket (e.g. immerse/eu/france/paris/hero-paris1.webp)
  publicUrl: string   // full public URL (works because bucket is public-read)
}

// ── WebP conversion ──────────────────────────────────────────────────────────

/**
 * Convert any browser-decodable image (jpg, png, gif, webp, etc) to a webp
 * Blob via canvas. Pure client-side — no network call. Preserves source
 * dimensions; does NOT resize.
 *
 * Why canvas: HTMLImageElement decodes any image format the browser can
 * display, and canvas.toBlob('image/webp') is supported in every modern
 * browser. No external library needed.
 *
 * Throws if the file isn't decodable as an image, or if the browser doesn't
 * support webp output (extremely rare in 2026 — Safari got it in 2020).
 */
export async function convertToWebp(
  file:    File,
  quality: number = 0.85,
): Promise<Blob> {
  // Decode the file to an Image element
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('failed to decode image'))
    }
    image.src = url
  })

  // Render to canvas at native dimensions
  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(img, 0, 0)

  // Encode to webp Blob
  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(b => resolve(b), 'image/webp', quality)
  })
  if (!blob) throw new Error('webp encoding failed')
  return blob
}

// ── Image upload (with webp conversion) ──────────────────────────────────────

/**
 * Upload an image as webp. Converts client-side, then POSTs the webp blob
 * to ambience-assets at the given path + filename.
 *
 * Args:
 *   file:     the source image file (any browser-decodable format)
 *   path:     folder path within the bucket, no leading or trailing slash
 *             (e.g. 'immerse/eu/france/paris')
 *   filename: filename without extension (e.g. 'hero-paris1'). The .webp
 *             extension is appended automatically.
 *   options.upsert: if true, overwrite an existing file at the same path.
 *                   Default false — collision returns an error.
 *   options.quality: webp quality 0.0–1.0. Default 0.85.
 *
 * Returns: { path, publicUrl } where path is the relative storage path.
 */
export async function uploadImageAsWebp(
  file:     File,
  path:     string,
  filename: string,
  options:  { upsert?: boolean; quality?: number } = {},
): Promise<UploadResult> {
  const webpBlob = await convertToWebp(file, options.quality ?? 0.85)
  const fullPath = `${path}/${filename}.webp`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, webpBlob, {
      contentType: 'image/webp',
      upsert:      options.upsert ?? false,
    })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath)
  return { path: fullPath, publicUrl: data.publicUrl }
}

// ── PDF upload (no conversion) ───────────────────────────────────────────────

/**
 * Upload a PDF as-is. No conversion. Used for floorplans.
 *
 * Args:
 *   file:     the source PDF file (must be application/pdf)
 *   path:     folder path within the bucket
 *   filename: filename without extension. The .pdf extension is appended.
 *   options.upsert: overwrite existing file at the same path.
 */
export async function uploadPdf(
  file:     File,
  path:     string,
  filename: string,
  options:  { upsert?: boolean } = {},
): Promise<UploadResult> {
  if (file.type !== 'application/pdf') {
    throw new Error(`expected application/pdf, got ${file.type}`)
  }
  const fullPath = `${path}/${filename}.pdf`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, file, {
      contentType: 'application/pdf',
      upsert:      options.upsert ?? false,
    })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath)
  return { path: fullPath, publicUrl: data.publicUrl }
}

// ── Folder listing (for collision detection + filename suggestions) ──────────

/**
 * List all files (and subfolders) directly under a path. Used by the
 * uploader UI to detect filename collisions and suggest the next number
 * in a series (e.g. fssc-1, fssc-2, fssc-3 → suggest fssc-4).
 *
 * Returns just the names — not full paths. Subfolders show up as entries
 * with id=null in the raw Supabase response; we strip those to file-only
 * since admins can't pick subfolders as targets here.
 */
export async function listFolderContents(path: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(path, { limit: 200, sortBy: { column: 'name', order: 'asc' } })

  if (error) throw error
  // Filter out subfolder placeholder rows (id is null for folders)
  return (data ?? [])
    .filter(item => item.id !== null)
    .map(item => item.name)
}

// ── Asset deletion ───────────────────────────────────────────────────────────

/**
 * Delete a file from the bucket. Used for replace-existing flows where
 * the new filename differs from the old. RLS-gated by is_admin_user().
 */
export async function deleteAsset(fullPath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([fullPath])
  if (error) throw error
}

// ── Filename collision helper ────────────────────────────────────────────────

/**
 * Given a desired filename and a list of existing filenames in a folder,
 * return:
 *   - status: 'ok' if no collision
 *             'collision' if exact match exists
 *   - nextNumberedFilename: a suggestion that appends/increments a numeric
 *     suffix (e.g. fssc-1 → fssc-2, paris-hero → paris-hero-2)
 *
 * Pure function — no I/O. Caller already has the folder listing.
 *
 * Examples:
 *   detectCollision('cbparis-1', ['cbparis-1.webp', 'cbparis-2.webp'])
 *     → { status: 'collision', nextNumberedFilename: 'cbparis-3' }
 *   detectCollision('hero-paris1', ['hero-paris2.webp'])
 *     → { status: 'ok', nextNumberedFilename: 'hero-paris1' }
 */
export function detectCollision(
  desiredFilename: string,        // without extension
  existingFiles:   string[],      // full filenames including extension
  extension:       string = 'webp',
): { status: 'ok' | 'collision'; nextNumberedFilename: string } {
  const exact = `${desiredFilename}.${extension}`
  const collision = existingFiles.includes(exact)

  // Find the highest existing number for files matching the base pattern
  // <base>-<N>.<ext> or <base><N>.<ext>
  const base = desiredFilename.replace(/-?\d+$/, '')
  const pattern = new RegExp(`^${escapeRegExp(base)}-?(\\d+)\\.${extension}$`, 'i')
  let maxN = 0
  for (const f of existingFiles) {
    const m = f.match(pattern)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maxN) maxN = n
    }
  }
  // Suggest the next number; default to base-1 if nothing exists yet
  const suggestion = maxN > 0 ? `${base}-${maxN + 1}` : `${base}-1`

  return {
    status: collision ? 'collision' : 'ok',
    nextNumberedFilename: collision ? suggestion : desiredFilename,
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}