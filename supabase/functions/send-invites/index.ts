// send-invites — mark waitlist entries invited and email them a signup link.
//
// Admin-only. The client (Admin → Lista de espera) calls this with a set of
// waitlist row ids; the function verifies the caller is an admin, then for each
// STILL-PENDING row sends a Spanish invite email and, only on a successful send,
// stamps invited_at = now(). A failed send leaves the row pending, so it stays
// selectable for a retry.
//
// invited_at is what 0022's allowlist trigger checks: once set, that email may
// register even while app_settings.waitlist_enabled is on. The invite email links
// to `${SITE_URL}/?invite=<id>`, which the app resolves (waitlist_invite_email) to
// pre-fill the signup form.
//
// Auth/client shape mirrors play-match (supabase/functions/_src/play-match.ts):
// a user client under the caller's JWT verifies identity + admin; a service-role
// client is the only thing that writes the waitlist. Registered in config.toml
// with verify_jwt = true, so the Supabase GitHub integration deploys it.
//
// Email delivery is direct SMTP (denomailer) over the SAME Cloudflare SMTP that
// Supabase Auth already uses — set the same host/port/user/pass as function
// secrets (SMTP_HOST/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD + INVITE_FROM_EMAIL).
// Edge Functions restrict some outbound SMTP ports; 465 with TLS is the reliable
// target (587 auto-STARTTLS). If SMTP_HOST is unset (local dev) the send is
// skipped and logged, and the row is still marked, so the flow is exercisable
// without a mail server.

import { createClient } from 'npm:@supabase/supabase-js@2.47.10'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

interface PendingRow {
  id: string
  email: string
}

/** The Spanish invite email body. Inline styles only — email clients strip <style>. */
function inviteHtml(inviteUrl: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#0f1a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;letter-spacing:-.02em;color:#4ade80;text-transform:uppercase">Super Gol</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px">Colecciona. Ficha. Compite.</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5">¡Tenemos sitio para ti! Ya puedes crear tu cuenta y empezar a jugar a Super Gol, el mítico juego de cartas de fútbol en tu móvil.</p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.5">Pulsa el botón para registrarte con este correo:</p>
    <a href="${inviteUrl}" style="display:inline-block;background:#22c55e;color:#052e16;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:16px">Crear mi cuenta</a>
    <p style="margin:28px 0 0;color:#64748b;font-size:13px;line-height:1.5">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${inviteUrl}" style="color:#4ade80;word-break:break-all">${inviteUrl}</a></p>
  </div>
</body></html>`
}

/**
 * Send one invite email over the shared SMTP client. Returns true on success. When
 * there is no client (SMTP_HOST unset — local dev) the send is skipped and logged,
 * and we report success so the flow is testable without a mail server.
 */
async function sendInvite(
  client: SMTPClient | null,
  from: string,
  email: string,
  inviteUrl: string,
): Promise<boolean> {
  if (!client) {
    console.log(`[send-invites] dev: no SMTP_HOST, would email ${email} → ${inviteUrl}`)
    return true
  }
  try {
    await client.send({
      from,
      to: email,
      subject: '¡Ya puedes jugar a Super Gol!',
      html: inviteHtml(inviteUrl),
    })
    return true
  } catch (err) {
    console.error(`[send-invites] SMTP send failed for ${email}:`, err)
    return false
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'not authenticated' }, 401)

  // User-scoped client: identifies the caller and reads their own profile under RLS.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: auth } = await userClient.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return json({ error: 'not authenticated' }, 401)

  // Admin gate, verified server-side (a forged client flag reveals nothing): read
  // the caller's own profile row, which RLS (0002) permits.
  const { data: profile, error: profileErr } = await userClient
    .from('profiles')
    .select('is_admin')
    .eq('id', uid)
    .maybeSingle()
  if (profileErr) return json({ error: profileErr.message }, 400)
  if (!profile?.is_admin) return json({ error: 'not authorized' }, 403)

  let body: { ids?: unknown } = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    // fall through to the empty-ids check
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : []
  if (ids.length === 0) return json({ error: 'no ids' }, 400)

  // Service-role client: the only thing that may read/write the waitlist.
  const adminClient = createClient(url, serviceKey)

  // Only still-pending rows are (re)invited; a prior failed send left invited_at
  // null, so it lands here again for a retry.
  const { data: rows, error: rowsErr } = await adminClient
    .from('waitlist')
    .select('id, email')
    .in('id', ids)
    .is('invited_at', null)
  if (rowsErr) return json({ error: rowsErr.message }, 400)

  const pending = (rows ?? []) as PendingRow[]
  const results: { id: string; email: string; ok: boolean }[] = []

  // One SMTP connection for the whole batch (closed in `finally`). Absent SMTP_HOST
  // = local dev: sendInvite logs instead of sending. 465 = implicit TLS.
  const smtpHost = Deno.env.get('SMTP_HOST')
  const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '465')
  const smtpUser = Deno.env.get('SMTP_USERNAME') ?? ''
  const from = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Super Gol <no-reply@localhost>'
  const client =
    pending.length > 0 && smtpHost
      ? new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: smtpPort,
            tls: smtpPort === 465,
            // Only authenticate when a username is set: denomailer refuses to send
            // credentials over a non-TLS link, so an unauthenticated relay (or a
            // plaintext local mail catcher) must omit auth entirely.
            auth: smtpUser
              ? { username: smtpUser, password: Deno.env.get('SMTP_PASSWORD') ?? '' }
              : undefined,
          },
        })
      : null

  try {
    for (const row of pending) {
      const inviteUrl = `${siteUrl}/?invite=${row.id}`
      const ok = await sendInvite(client, from, row.email, inviteUrl)
      if (ok) {
        const { error: updErr } = await adminClient
          .from('waitlist')
          .update({ invited_at: new Date().toISOString() })
          .eq('id', row.id)
        results.push({ id: row.id, email: row.email, ok: !updErr })
      } else {
        results.push({ id: row.id, email: row.email, ok: false })
      }
    }
  } finally {
    // denomailer's close() returns void (not a Promise) and throws SYNCHRONOUSLY
    // when the connection never opened — so guard with try/catch, never `.catch()`
    // (chaining on the void return is itself a TypeError). Teardown must not mask
    // the per-row results already collected.
    if (client) {
      try {
        await client.close()
      } catch {
        // connection never established or already closed — nothing to tear down
      }
    }
  }

  const sent = results.filter((r) => r.ok).length
  return json({ sent, failed: results.length - sent, results })
})
