import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// S30D: /img dev proxy mirrors the Vercel rewrite in vercel.json so dev and
// prod share the same image-URL surface. rewriteImageUrl in src/lib/imageUrl.ts
// strips the Supabase storage prefix at the read layer; this proxy resolves
// the resulting '/img/...' paths during `npm run dev`. Production resolves
// them via Vercel edge-side rewrite.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'supabase/functions/_shared'),
    },
  },
  server: {
    proxy: {
      '/img': {
        target: 'https://rjobcbpnhymuczjhqzmh.supabase.co',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/img/, '/storage/v1/object/public/ambience-assets'),
      },
    },
  },
})