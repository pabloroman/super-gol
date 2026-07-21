-- Pre-launch waitlist + a server-enforced registration gate.
--
-- While the game is unfinished we want to CLOSE self-service signup and collect
-- emails on a waitlist instead, then reopen registration later by flipping one
-- flag from the Admin screen — no redeploy. Two pieces:
--
--   * app_settings.waitlist_enabled — the flag. World-readable (anon picks the
--     landing CTA from it) and written only through an admin RPC, exactly the
--     posture cards/packs use for public reads (0002 policy + 0007 grant).
--   * a BEFORE INSERT trigger on auth.users that REFUSES signups while the flag
--     is on. The frontend already hides the signup form in that mode, so this is
--     the backstop for a direct-API bypass — the same "check before signUp, the
--     trigger is the backstop" split 0017 documents. Its raise reaches the
--     browser as "{}" (see CLAUDE.md → Auth & signup), so it stays
--     English/developer-facing; a real user never sees it.
--
-- Signing IN is untouched — only new registration is gated.

-- ---------------------------------------------------------------------------
-- 1. app_settings: a single-row table of public, non-sensitive app config.
--    The check(id) + boolean PK pins it to exactly one row, so readers can
--    `limit 1` without a key.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id               boolean primary key default true,
  waitlist_enabled boolean not null default true,
  updated_at       timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

-- Seed the row. Default waitlist_enabled = true, so a fresh production database
-- starts GATED (safe pre-launch default); local dev opens it in seed.sql.
insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

-- Public read: anyone, incl. signed-out visitors, may read the flag — the
-- landing page decides its CTA from it before there is a session. Nothing
-- sensitive belongs in this table for exactly that reason. Mirrors "cards are
-- public" (0002). Writes go through admin_set_waitlist below, so no write grant.
create policy "app_settings are public" on public.app_settings
  for select using (true);

-- A policy is only consulted after the table-level privilege check passes, so
-- the SELECT grant is required alongside it (0007's lesson).
grant select on public.app_settings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. waitlist: the emails collected while registration is closed.
--    RLS on, and NO grant to anon/authenticated: the table is reachable only
--    through the SECURITY DEFINER RPCs below, so the list cannot be read or
--    enumerated from the client. join_waitlist inserts; admin_list_waitlist
--    reads; both bypass RLS as owner.
-- ---------------------------------------------------------------------------
create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  created_at timestamptz not null default now(),
  -- Lenient shape check: a backstop for the RPC's own validation and the client's.
  constraint waitlist_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Case-insensitive uniqueness, like profiles' handle (0017): 'A@x.com' and
-- 'a@x.com' are one entry. Also the arbiter join_waitlist's ON CONFLICT targets.
create unique index waitlist_email_key on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- ---------------------------------------------------------------------------
-- 3. join_waitlist(): anon-callable add-to-list. Idempotent — a repeat email is
--    a silent success, never an error and never an "already registered" tell
--    (no enumeration). The client validates first and shows a Spanish message;
--    this raise is the backstop and stays English.
-- ---------------------------------------------------------------------------
create or replace function public.join_waitlist(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := btrim(coalesce(p_email, ''));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = 'check_violation';
  end if;

  insert into public.waitlist (email)
  values (v_email)
  on conflict (lower(email)) do nothing;
end;
$$;

-- Callable without a session — the landing page has no user yet, same as
-- username_available/email_for_login (0017).
grant execute on function public.join_waitlist(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_set_waitlist(): flip the flag. Admin-only, structurally identical to
--    admin_set_admin (0011): the client may CALL it, but require_admin() (0006)
--    verifies profiles.is_admin server-side, so the flag cannot be forged.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_waitlist(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  update public.app_settings
    set waitlist_enabled = p_enabled, updated_at = now()
    where id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. admin_list_waitlist(): the signups the Admin screen shows and exports.
--    email is admin-only PII, which is why this is an RPC and not a view — same
--    reasoning as admin_list_users (0011).
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_waitlist()
returns table (
  id         uuid,
  email      text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select w.id, w.email, w.created_at
  from public.waitlist w
  order by w.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. The server-side gate: refuse new auth.users rows while the flag is on.
--    SECURITY DEFINER so it can read app_settings regardless of which role
--    GoTrue inserts as (same reason handle_new_user is definer). A SEPARATE
--    BEFORE trigger, not folded into handle_new_user (0017): BEFORE fires ahead
--    of the AFTER on_auth_user_created, so it rejects cleanly before any profile
--    work, and 0017's new-user logic is left untouched.
--
--    The seed creates its dev accounts by inserting into auth.users, so it fires
--    this too — seed.sql sets waitlist_enabled = false before that loop.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_signups_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select waitlist_enabled from public.app_settings limit 1) then
    raise exception 'signups are closed';
  end if;
  return new;
end;
$$;

drop trigger if exists before_auth_user_created on auth.users;
create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.enforce_signups_open();
