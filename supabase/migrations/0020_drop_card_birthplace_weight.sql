-- Drop the never-populated birthplace / weight_kg columns from cards.
-- The vendored Transfermarkt snapshot carries neither, so both were always NULL
-- across all 518 catalog rows, no UI ever filled them, and there is no plan to add
-- them. Remove the columns and rebuild admin_upsert_cards (0006), the only function
-- that named them.

alter table public.cards
  drop column if exists birthplace,
  drop column if exists weight_kg;

-- Recreate admin_upsert_cards (0006) without the two dropped columns. Body is
-- otherwise identical, including the is_starter two-pass (see 0006 for the rationale).
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
    id, name, full_name, club, club_slug, nationality, birth_date,
    height_cm, position, cost, rarity, is_starter, abilities,
    zone_grid, image_url
  )
  select
    x.id, x.name, x.full_name, x.club, x.club_slug, x.nationality,
    x.birth_date, x.height_cm, x.position, x.cost,
    coalesce(x.rarity, 'comun')::card_rarity, coalesce(x.is_starter, false),
    coalesce(x.abilities, '{}'::jsonb), coalesce(x.zone_grid, '[]'::jsonb),
    x.image_url
  from jsonb_to_recordset(p_cards) as x(
    id text, name text, full_name text, club text, club_slug text,
    nationality text, birth_date date, height_cm int,
    position text, cost int, rarity text, is_starter boolean,
    abilities jsonb, zone_grid jsonb, image_url text
  )
  on conflict (id) do update set
    name = excluded.name, full_name = excluded.full_name, club = excluded.club,
    club_slug = excluded.club_slug, nationality = excluded.nationality,
    birth_date = excluded.birth_date, height_cm = excluded.height_cm,
    position = excluded.position, cost = excluded.cost, rarity = excluded.rarity,
    abilities = excluded.abilities, zone_grid = excluded.zone_grid,
    image_url = excluded.image_url;
    -- NOTE: is_starter intentionally omitted here — see the second pass below.

  get diagnostics v_count = row_count;

  -- Apply is_starter only where the payload explicitly provides it, so an import
  -- that omits the column never disturbs the starter deck.
  update public.cards c
  set is_starter = x.is_starter
  from jsonb_to_recordset(p_cards) as x(id text, is_starter boolean)
  where c.id = x.id and x.is_starter is not null;

  return v_count;
end;
$$;
