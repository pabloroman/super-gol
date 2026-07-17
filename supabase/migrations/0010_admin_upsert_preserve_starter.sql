-- Make is_starter "sticky" across catalog imports.
--
-- The starter deck (the 55 cards flagged is_starter, granted to new users) is
-- owned by 0009_starter_deck.sql, not the card catalog. But admin_upsert_cards
-- (0006) wrote `is_starter = excluded.is_starter` on every conflict, so any
-- catalog CSV that omitted the column — e.g. the generated
-- data/laliga-2025-cards.csv — silently reset all 55 flags to false on import.
--
-- Fix: the bulk upsert no longer touches is_starter at all. is_starter is then
-- applied in a second pass ONLY for payload rows that explicitly provide it
-- (the per-card admin editor, or a CSV that carries the column). A CSV without
-- the column leaves the deck untouched. New rows still default to false.

create or replace function public.admin_upsert_cards(p_cards jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform public.require_admin();

  insert into public.cards as c (
    id, name, full_name, club, club_slug, nationality, birthplace, birth_date,
    height_cm, weight_kg, position, cost, rarity, is_starter, abilities,
    zone_grid, image_url
  )
  select
    x.id, x.name, x.full_name, x.club, x.club_slug, x.nationality, x.birthplace,
    x.birth_date, x.height_cm, x.weight_kg, x.position, x.cost,
    coalesce(x.rarity, 'comun')::card_rarity, coalesce(x.is_starter, false),
    coalesce(x.abilities, '{}'::jsonb), coalesce(x.zone_grid, '[]'::jsonb),
    x.image_url
  from jsonb_to_recordset(p_cards) as x(
    id text, name text, full_name text, club text, club_slug text,
    nationality text, birthplace text, birth_date date, height_cm int,
    weight_kg int, position text, cost int, rarity text, is_starter boolean,
    abilities jsonb, zone_grid jsonb, image_url text
  )
  on conflict (id) do update set
    name = excluded.name, full_name = excluded.full_name, club = excluded.club,
    club_slug = excluded.club_slug, nationality = excluded.nationality,
    birthplace = excluded.birthplace, birth_date = excluded.birth_date,
    height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
    position = excluded.position, cost = excluded.cost, rarity = excluded.rarity,
    abilities = excluded.abilities, zone_grid = excluded.zone_grid,
    image_url = excluded.image_url;
    -- NOTE: is_starter intentionally omitted here — see second pass below.

  get diagnostics v_count = row_count;

  -- Apply is_starter only where the payload explicitly provides it, so an import
  -- that omits the column never disturbs the migration-owned starter deck.
  update public.cards c
  set is_starter = x.is_starter
  from jsonb_to_recordset(p_cards) as x(id text, is_starter boolean)
  where c.id = x.id and x.is_starter is not null;

  return v_count;
end;
$$;
