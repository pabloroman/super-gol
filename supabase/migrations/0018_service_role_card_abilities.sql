-- push:cards support — sync hand-edited card ability blobs to a live database.
--
-- `npm run push:cards` reads scripts/cards/data/abilities.json (the hand-editable
-- source of truth for card factors) and applies it to an already-migrated database.
-- Regenerating 0005 is seed-only and never re-runs on prod (the migration ledger
-- keys on the version prefix), so this RPC is the one channel for ability changes
-- there — 0005 (fresh db:reset) and a push both derive from abilities.json.
--
-- Posture matches record_match (0004) and finish_match_session (0014): server-only
-- writes go through a SECURITY DEFINER function granted to service_role alone, never
-- to the browser roles. Tables here are owned by `postgres`, so service_role has no
-- direct table privilege (same root cause 0007 fixed for anon/authenticated) — the
-- definer function bypasses that as owner. The catalog is already public-readable
-- (0007 grants anon SELECT on cards); we add the matching SELECT for service_role so
-- the tool can diff before writing. The function updates ONLY the abilities column
-- and ONLY existing rows (no insert), so name/cost/rarity/is_starter/zone_grid/
-- image_url and the migration-owned starter deck are never touched, and a partial
-- abilities.json can never create a NULL-name row.

grant select on public.cards to service_role;

create or replace function public.service_set_card_abilities(p_cards jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.cards as c
     set abilities = x.abilities
    from jsonb_to_recordset(p_cards) as x(id text, abilities jsonb)
   where c.id = x.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Server-only: callable by the service_role secret, never the browser roles.
revoke execute on function public.service_set_card_abilities(jsonb) from public;
revoke execute on function public.service_set_card_abilities(jsonb) from anon, authenticated;
grant  execute on function public.service_set_card_abilities(jsonb) to service_role;
