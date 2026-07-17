-- Admin user management.
-- Three SECURITY DEFINER RPCs behind the same require_admin() guard 0006 built
-- for the catalog: the client may CALL them, but each verifies profiles.is_admin
-- server-side, so admin rights cannot be forged. No RLS or grant changes — 0002
-- still lets a client read only its own profile row, and these functions bypass
-- that as owner rather than widening the policy for everyone.

-- ============================================================
-- admin_list_users: every profile plus the counts the admin screen shows.
-- ============================================================
-- Reads auth.users for the email. profiles.username is nullable and user-chosen,
-- so it is a label rather than the thing an admin identifies someone by; the
-- email is. That is also why this stays an admin-only RPC and not a view: it
-- exposes PII no player may read, and 0002 deliberately lets a client see only
-- its own profile row.
create or replace function public.admin_list_users()
returns table (
  id             uuid,
  username       text,
  email          text,
  coins          bigint,
  is_admin       boolean,
  created_at     timestamptz,
  cards_owned    bigint,
  matches_played bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  -- Every column is qualified: the RETURNS TABLE parameters share these names,
  -- and an unqualified reference would be ambiguous at runtime.
  return query
  select
    p.id,
    p.username,
    u.email::text,
    p.coins,
    p.is_admin,
    p.created_at,
    coalesce(uc.n, 0) as cards_owned,
    coalesce(m.n, 0)  as matches_played
  from public.profiles p
  left join auth.users u on u.id = p.id
  -- Pre-aggregated rather than correlated counts: one pass per table instead of
  -- two subqueries per profile.
  left join (
    select uc2.user_id, sum(uc2.quantity)::bigint as n
    from public.user_cards uc2
    group by uc2.user_id
  ) uc on uc.user_id = p.id
  left join (
    select m2.user_id, count(*)::bigint as n
    from public.matches m2
    group by m2.user_id
  ) m on m.user_id = p.id
  order by p.created_at desc;
end;
$$;

-- ============================================================
-- admin_set_admin: grant or revoke the is_admin flag.
-- ============================================================
create or replace function public.admin_set_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  -- Self-revoke is the one move with no way back: is_admin is settable only from
  -- the DB or by another admin, so an admin who demotes themselves while they are
  -- the last one locks the flag out of the app permanently.
  if p_user_id = auth.uid() and not p_is_admin then
    raise exception 'you cannot revoke your own admin flag' using errcode = '42501';
  end if;

  update public.profiles set is_admin = p_is_admin where id = p_user_id;
  if not found then
    raise exception 'unknown user %', p_user_id;
  end if;
end;
$$;

-- ============================================================
-- admin_adjust_coins: credit or debit a wallet, through the ledger.
-- Returns the new balance.
-- ============================================================
-- p_amount is signed, matching transactions.amount (+earn / -spend). Every other
-- coin movement in the schema writes a ledger row; a manual grant that skipped it
-- would make the ledger stop summing to the balance.
create or replace function public.admin_adjust_coins(
  p_user_id uuid,
  p_amount  bigint,
  p_reason  text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins bigint;
begin
  perform public.require_admin();

  if p_amount = 0 then
    raise exception 'amount must not be zero';
  end if;

  -- Lock the wallet row, same as open_pack: two admins adjusting at once would
  -- otherwise both read the old balance and one write would vanish.
  select coins into v_coins from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'unknown user %', p_user_id;
  end if;

  -- profiles.coins carries a `check (coins >= 0)`, so this is really a check
  -- constraint waiting to fire. Raising first turns it into a readable message.
  if v_coins + p_amount < 0 then
    raise exception 'balance would go negative: % % = %',
      v_coins, p_amount, v_coins + p_amount;
  end if;

  update public.profiles set coins = coins + p_amount where id = p_user_id;

  insert into public.transactions (user_id, amount, kind, ref)
  values (p_user_id, p_amount, 'admin_adjust', nullif(btrim(coalesce(p_reason, '')), ''));

  return v_coins + p_amount;
end;
$$;
