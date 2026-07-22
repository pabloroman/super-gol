-- Per-person waitlist invites: an allowlist gate on top of 0021's on/off gate.
--
-- 0021 made registration all-or-nothing: while app_settings.waitlist_enabled is
-- on, the BEFORE INSERT trigger on auth.users refuses EVERY signup. To bring the
-- waitlist in gradually we want to keep the public gate closed but let INDIVIDUALLY
-- INVITED emails through. Three pieces:
--
--   * waitlist.invited_at — a nullable timestamp. null = pending, set = invited
--     (and records WHEN, which the send-invites Edge Function stamps on a
--     successful email send).
--   * enforce_signups_open() — rewritten to admit an email that has invited_at set
--     even while gated, and refuse everyone else.
--   * waitlist_invite_email() — resolves the ?invite=<id> link in the invite email
--     back to its address, so the signup form can pre-fill (and lock) it.
--
-- Marking a row invited is done by the send-invites function under service_role,
-- NOT an admin RPC: require_admin() needs an auth.uid() a service key lacks (the
-- same constraint push:cards documents). admin_list_waitlist() gains invited_at so
-- the Admin screen can show status; the invite SEND is triggered from there too.

-- ---------------------------------------------------------------------------
-- 1. The invited mark.
-- ---------------------------------------------------------------------------
alter table public.waitlist add column invited_at timestamptz;

-- The send-invites Edge Function reads the pending rows and stamps invited_at
-- directly under service_role. service_role bypasses RLS but still needs a
-- table-level grant, and waitlist is owned by postgres, so it has none (0021
-- granted the table to nobody). Grant exactly what the function uses — SELECT to
-- read, UPDATE to mark; no INSERT (join_waitlist owns that) and no anon/
-- authenticated grant, so 0021's "clients cannot touch waitlist" posture stands.
-- Mirrors 0014's match_sessions grant and 0018's cards grant to service_role.
grant select, update on public.waitlist to service_role;

-- ---------------------------------------------------------------------------
-- 2. The gate, now allowlist-aware. Still refuses signups while the flag is on,
--    but makes an exception for an email that was explicitly invited from the
--    waitlist. Case-insensitive match mirrors the lower(email) unique index. The
--    seed sets waitlist_enabled = false before its dev-account inserts, so this
--    branch never runs there (0021's note still holds).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_signups_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select waitlist_enabled from public.app_settings limit 1) then
    -- Gated: allow only emails explicitly invited from the waitlist.
    if not exists (
      select 1 from public.waitlist
      where lower(email) = lower(new.email)
        and invited_at is not null
    ) then
      raise exception 'signups are closed';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. admin_list_waitlist() gains invited_at so the Admin screen can show each
--    entry's status. Changing a function's return signature needs a DROP first —
--    create-or-replace cannot alter OUT columns.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_waitlist();

create function public.admin_list_waitlist()
returns table (
  id         uuid,
  email      text,
  created_at timestamptz,
  invited_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select w.id, w.email, w.created_at, w.invited_at
  from public.waitlist w
  order by w.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. waitlist_invite_email(): resolve an invite link's id to its email, so the
--    signup form can pre-fill and lock it. Returns the address ONLY for a row
--    that has been invited (invited_at set); null for an unknown or still-pending
--    id, so an uninvited row's email is never disclosed.
--
--    Anon-callable by design: the invited visitor has no session yet. The random
--    uuid in the link is effectively a bearer token — the same disclosure model as
--    a magic link (holding the link is holding the invite), and it only ever yields
--    the address that link was already sent to.
-- ---------------------------------------------------------------------------
create or replace function public.waitlist_invite_email(p_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.waitlist
  where id = p_id
    and invited_at is not null;
$$;

grant execute on function public.waitlist_invite_email(uuid) to anon, authenticated;
