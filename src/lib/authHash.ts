// Read an auth error handed back in the URL hash, e.g.
// `#error=access_denied&error_code=otp_expired&error_description=...`.
// Supabase appends this when an email link (email confirmation or password
// recovery) is invalid or expired. Reading it lets the UI show a Spanish
// explanation instead of a bare form. Shared by Login (confirmation links) and
// ResetPassword (recovery links).
//
// It also strips the hash from the URL so a refresh doesn't re-surface the error.
// A *successful* link carries `#access_token=…` instead, which supabase-js
// `detectSessionInUrl` consumes before render — that case returns null here.
export function readHashError(): { code: string | null; description: string | null } | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null
  const params = new URLSearchParams(hash)
  if (!params.get('error') && !params.get('error_code')) return null
  const result = {
    code: params.get('error_code'),
    description: params.get('error_description'),
  }
  // Clean the hash so a refresh doesn't re-show the error.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return result
}
