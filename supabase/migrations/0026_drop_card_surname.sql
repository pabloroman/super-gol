-- Drop the deprecated `name` (uppercased surname) column from cards.
-- The catalog now leads with `full_name` everywhere — the naipe, the match chronicle
-- (via displayName), search and sort — so the surname shorthand is dead weight. Promote
-- `full_name` to the single, required player name: backfill any blank from the surname,
-- add NOT NULL, drop `name`, and rebuild admin_upsert_cards (0020) without it.

-- No row should reach here without a full_name (the generator always sets it), but an
-- admin CSV/editor could have blanked it — fall back to the surname so nothing loses its
-- name before the NOT NULL constraint lands.
update public.cards
  set full_name = name
  where full_name is null or btrim(full_name) = '';

alter table public.cards
  alter column full_name set not null;

alter table public.cards
  drop column name;

-- Recreate admin_upsert_cards (0020) without the `name` column. Body is otherwise
-- identical, including the is_starter two-pass (see 0006 for the rationale).
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
    id, full_name, club, club_slug, nationality, birth_date,
    height_cm, position, cost, rarity, is_starter, abilities,
    zone_grid, image_url
  )
  select
    x.id, x.full_name, x.club, x.club_slug, x.nationality,
    x.birth_date, x.height_cm, x.position, x.cost,
    coalesce(x.rarity, 'comun')::card_rarity, coalesce(x.is_starter, false),
    coalesce(x.abilities, '{}'::jsonb), coalesce(x.zone_grid, '[]'::jsonb),
    x.image_url
  from jsonb_to_recordset(p_cards) as x(
    id text, full_name text, club text, club_slug text,
    nationality text, birth_date date, height_cm int,
    position text, cost int, rarity text, is_starter boolean,
    abilities jsonb, zone_grid jsonb, image_url text
  )
  on conflict (id) do update set
    full_name = excluded.full_name, club = excluded.club,
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
