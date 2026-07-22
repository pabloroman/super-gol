-- Let an admin retune store pack prices in-app, so the economy can be tuned
-- without a migration each time. Pack prices are read live by the Store
-- (fetchPacks), so an edit takes effect on the next load.
--
-- packs is read-only to clients (SELECT-only RLS in 0002, SELECT-only grant in
-- 0007), so the write goes through a SECURITY DEFINER RPC behind require_admin(),
-- exactly like every other admin_* write. No grant/revoke: like the other admin
-- RPCs (0006/0011/0021) it relies on Postgres's default EXECUTE-to-PUBLIC plus the
-- in-body require_admin() guard, which raises 42501 for non-admins.

create or replace function public.admin_set_pack_price(p_pack_id text, p_price int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  -- packs.price carries check (price >= 0); pre-check for a readable message,
  -- as admin_adjust_coins does for the wallet's own check.
  if p_price < 0 then
    raise exception 'price must be non-negative';
  end if;

  update public.packs set price = p_price where id = p_pack_id;
  if not found then
    raise exception 'unknown pack %', p_pack_id;
  end if;
end;
$$;
