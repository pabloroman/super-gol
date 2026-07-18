-- Username becomes a required, uniquely-owned, format-checked PUBLIC handle,
-- and login by username is enabled without leaking the private email.
--
-- Why this reverses 0012's "blank -> NULL": 0012 made the coach name optional so
-- blank signups could not collide. The product has since moved on — the username
-- is the identifier a coach is matched by in 1v1, so it is now mandatory, unique,
-- and restricted to an Instagram-style character set. The uniqueness is
-- CASE-INSENSITIVE ('Pablo' and 'pablo' are the same handle); the stored casing
-- is whatever the user typed.
--
-- Client mirror: src/lib/username.ts (format) and username_available() below.
-- The DB is the authority; the client copies exist only to say something true in
-- Spanish before signUp, since a trigger exception reaches supabase-js as "{}"
-- (see CLAUDE.md → Auth & signup).

-- ---------------------------------------------------------------------------
-- 1. Backfill: give every legacy row a valid, unique username so NOT NULL and
--    the unique index below cannot fail on existing data. NULL/blank handles
--    (allowed by 0012) become 'user<hex-of-id>' — all-alphanumeric, 20 chars,
--    unique by construction. Runs BEFORE the CHECK is added, so it is never
--    rejected by the new format rule.
-- ---------------------------------------------------------------------------
update public.profiles
set username = 'user' || substr(replace(id::text, '-', ''), 1, 16)
where username is null or btrim(username) = '';

-- Resolve any case-insensitive collisions that the old case-SENSITIVE unique
-- constraint permitted (e.g. 'Pablo' + 'pablo'), keeping the earliest and
-- suffixing the rest. Without this the unique index on lower(username) would
-- fail and block the whole migration (and, via the GitHub integration, every
-- later one).
with ranked as (
  select id,
         username,
         row_number() over (partition by lower(username) order by created_at, id) as rn
  from public.profiles
)
update public.profiles p
set username = left(r.username, 24) || '_' || substr(replace(p.id::text, '-', ''), 1, 4)
from ranked r
where p.id = r.id and r.rn > 1;

-- ---------------------------------------------------------------------------
-- 2. Constraints: NOT NULL, case-insensitive uniqueness, and format.
-- ---------------------------------------------------------------------------
alter table public.profiles alter column username set not null;

-- Swap the case-sensitive unique constraint (0001's `username text unique`,
-- auto-named profiles_username_key) for a case-insensitive unique index. The
-- index name matters: handle_new_user reads it back from the violation below to
-- tell a duplicate handle apart from any other unique fault.
alter table public.profiles drop constraint profiles_username_key;
create unique index profiles_username_lower_key on public.profiles (lower(username));

-- Format: Instagram-exact. NOT VALID so pre-existing rows that predate the rule
-- are left alone; every INSERT/UPDATE from here on is checked, which is all the
-- signup path needs. Mirrors src/lib/username.ts.
alter table public.profiles
  add constraint profiles_username_format check (
    username ~ '^[A-Za-z0-9._]{3,30}$'
    and username !~ '\.\.'
    and username !~ '^\.'
    and username !~ '\.$'
  ) not valid;

-- ---------------------------------------------------------------------------
-- 3. username_available(): now case-insensitive, matching the unique index.
--    Still callable by anon (the signup form has no session yet); still answers
--    only taken/free for one exact name, so profiles RLS stays own-row-only.
-- ---------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(nullif(btrim(p_username), ''))
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. handle_new_user(): username is now REQUIRED and format-checked. These
--    raises are backstops — the client validates first — and reach the browser
--    as "{}", so they stay English/developer-facing per CLAUDE.md.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_coins constant bigint := 500;
  v_username    text := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
  v_constraint  text;
begin
  if v_username is null then
    raise exception 'username is required' using errcode = 'check_violation';
  end if;
  if v_username !~ '^[A-Za-z0-9._]{3,30}$'
     or v_username ~ '\.\.'
     or v_username ~ '^\.'
     or v_username ~ '\.$' then
    raise exception 'username % has an invalid format', v_username
      using errcode = 'check_violation';
  end if;

  begin
    insert into public.profiles (id, username, coins)
    values (new.id, v_username, v_start_coins);
  exception
    -- Backstop for the race username_available() cannot close: two signups
    -- claiming one handle between the check and the insert. Refusing is correct;
    -- the loser retries.
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      -- Only the username collision is a user mistake. The unique index (not the
      -- old named constraint) is what fires now, so match its name.
      if v_constraint = 'profiles_username_lower_key' then
        raise exception 'username % is already taken', v_username
          using errcode = 'unique_violation';
      end if;
      raise;
  end;

  insert into public.transactions (user_id, amount, kind, ref)
  values (new.id, v_start_coins, 'starter_grant', 'welcome');

  insert into public.user_cards (user_id, card_id, quantity)
  select new.id, c.id, 1
  from public.cards c
  where c.is_starter;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. email_for_login(): resolve a username to its account email for sign-in,
--    WITHOUT leaking the private email. Supabase Auth only signs in by
--    email/phone, so login-by-username needs the server to hand back the email —
--    but the username is public, so returning it to anyone would map a public
--    handle to a private address. This function returns the email ONLY when the
--    supplied password already verifies against auth.users, so a caller learns
--    nothing they could not learn by simply logging in.
--
--    The client calls this only for a username (an input containing '@' is
--    treated as an email and used directly, never sent here). Callable by anon
--    on purpose: sign-in has no session yet. bcrypt via pgcrypto (extensions
--    schema) is exactly how GoTrue and seed.sql hash the password.
-- ---------------------------------------------------------------------------
create or replace function public.email_for_login(p_identifier text, p_password text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(btrim(p_identifier))
    and u.encrypted_password is not null
    and u.encrypted_password = extensions.crypt(p_password, u.encrypted_password)
  limit 1;
$$;
