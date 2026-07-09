/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  // Current dashboard name.
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  // Legacy name, still accepted as a fallback.
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
