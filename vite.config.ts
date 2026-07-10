import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_-prefixed vars to client code. The Supabase/Vercel
  // integration provisions its keys under un-prefixed names (SUPABASE_* and
  // NEXT_PUBLIC_SUPABASE_*), so we map the two public values onto the VITE_
  // names the app reads. We map ONLY these two public values explicitly — never
  // widen envPrefix to `SUPABASE_`, which would leak SUPABASE_SERVICE_ROLE_KEY
  // into the browser bundle. A local `.env` (VITE_*) still takes precedence.
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl =
    env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Super Gol',
          short_name: 'Super Gol',
          description: 'Collect, build and compete — the 90s Marca football card game, reborn.',
          theme_color: '#0b6b3a',
          background_color: '#0b1a12',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
