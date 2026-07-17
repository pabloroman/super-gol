-- Fix: a blank coach name broke every signup after the first.
--
-- profiles.username is `unique` (0001), but handle_new_user (0003) defaulted it
-- to 'Entrenador' and Login.tsx sent `username || 'Entrenador'`. So the first
-- user to leave the field blank claimed that name for good, and every later one
-- failed signup. This trigger runs inside the auth transaction, so raising here
-- rolls the whole auth.users insert back: the account is simply never created.
--
-- The constraint stays — a coach name is a handle, and reserving it is the point.
--
-- 1. Blank/absent -> NULL, instead of 'Entrenador'. A unique index accepts any
--    number of NULLs, so blank signups can no longer collide with each other.
--    Both render sites already fall back to 'Entrenador' for a null (Home.tsx and
--    the admin list), so those users see exactly what they saw before — the name
--    was only ever a display label.
--
-- 2. username_available() lets the client check a typed name BEFORE signing up.
--    This is the only way to show a real message: supabase-js turns any 500 into
--    an AuthRetryableFetchError and DISCARDS the body, so anything this trigger
--    raises reaches the browser as the literal string "{}" — verified against a
--    local stack. That is also what the original raw 23505 looked like to a user.
--    User-facing copy therefore lives in Login.tsx, and the exception below stays
--    English and developer-facing, per the language policy in CLAUDE.md.

-- Is this coach name free? Callable by `anon` on purpose: it runs on the signup
-- form, before the user has a session. It answers only "taken or not" for an
-- exact name — no listing, no prefix search — and profiles RLS is untouched, so
-- this is the one deliberate crack of light in an otherwise own-row-only table.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  -- btrim to match what handle_new_user stores. A blank name is always
  -- "available": it becomes NULL, and NULLs never collide.
  select not exists (
    select 1 from public.profiles where username = nullif(btrim(p_username), '')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_coins constant bigint := 500;
  -- btrim before nullif so a name of only spaces counts as blank rather than
  -- reserving an invisible handle.
  v_username    text := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
  v_constraint  text;
begin
  begin
    insert into public.profiles (id, username, coins)
    values (new.id, v_username, v_start_coins);
  exception
    -- The backstop for the race username_available() cannot close: two signups
    -- claiming one name between the check and the insert. Catching the violation
    -- rather than pre-checking with EXISTS is deliberate — a check would lose the
    -- same race. Refusing is correct; the loser retries.
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      -- Only the username collision is a user mistake. Anything else unique on
      -- this table (the id PK) is a real fault and must not be dressed up as one.
      if v_constraint = 'profiles_username_key' then
        raise exception 'username % is already taken', v_username
          using errcode = 'unique_violation';
      end if;
      raise;
  end;

  insert into public.transactions (user_id, amount, kind, ref)
  values (new.id, v_start_coins, 'starter_grant', 'welcome');

  -- Grant the "juego básico": every card flagged is_starter.
  insert into public.user_cards (user_id, card_id, quantity)
  select new.id, c.id, 1
  from public.cards c
  where c.is_starter;

  return new;
end;
$$;
