-- Admin card management.
-- Adds an is_admin flag to profiles and two SECURITY DEFINER RPCs the in-app
-- admin screen uses to write the catalog. Same posture as the economy functions
-- (0003/0004): the client may CALL them, but each verifies profiles.is_admin for
-- the caller server-side, so admin rights cannot be forged. cards RLS is
-- unchanged (public SELECT only) — these functions bypass it as owner.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Guard: raise unless the current user is a flagged admin.
create or replace function public.require_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

-- Upsert a batch of cards from a jsonb array of card objects (the client's Card
-- shape). Returns the number of rows written.
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
    is_starter = excluded.is_starter, abilities = excluded.abilities,
    zone_grid = excluded.zone_grid, image_url = excluded.image_url;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_delete_card(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  delete from public.cards where id = p_id;
end;
$$;
