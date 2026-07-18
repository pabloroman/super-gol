-- Lower the squad point cap from 100 to 70.
--
-- The cap is a deck-building deviation: the juego básico «no utiliza la ficha»
-- (rulebook page 12), so the number is borrowed from the tournament rule (page 29),
-- which caps the sum of 16 players' fichas at 100 (~6.25/player). This game fields
-- an 11-player squad, so the faithful budget is 100 × 11/16 ≈ 70 — which also matches
-- the LaLiga catalog's mean squad cost (~11 × 6.34). At 100 the cap barely bound for
-- 11 players; 70 makes it a real budget. Mirrors POINT_CAP in src/game/squad.ts.
--
-- create-or-replace can't edit a single line, so re-declare the whole function
-- (0016's body verbatim) with only the cap literal and its message changed. Existing
-- saved squads are left untouched — the cap is re-checked on the next save, not now.

create or replace function public.save_squad(
  p_name      text,
  p_starters  text[]
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_cost      int;
  v_squad_id  bigint;
  v_card      text;
  v_slot      int;
  v_gk        int;
  v_df        int;
  v_mf        int;
  v_fw        int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if array_length(p_starters, 1) is distinct from 11 then
    raise exception 'a squad needs exactly 11 starters';
  end if;

  -- No player twice.
  if (select count(distinct x) from unnest(p_starters) x) <> array_length(p_starters, 1) then
    raise exception 'a player cannot appear twice in the squad';
  end if;

  -- Must own every listed card.
  foreach v_card in array p_starters loop
    if not exists (
      select 1 from public.user_cards
      where user_id = v_uid and card_id = v_card and quantity > 0
    ) then
      raise exception 'you do not own card %', v_card;
    end if;
  end loop;

  -- 70-point cap.
  select coalesce(sum(cost), 0) into v_cost
  from public.cards where id = any (p_starters);
  if v_cost > 70 then
    raise exception 'squad costs % points (max 70)', v_cost;
  end if;

  -- Composition: exactly one portero + at least one in each outfield line.
  select
    count(*) filter (where c.position = 'GK'),
    count(*) filter (where c.position = 'DF'),
    count(*) filter (where c.position = 'MF'),
    count(*) filter (where c.position = 'FW')
  into v_gk, v_df, v_mf, v_fw
  from public.cards c where c.id = any (p_starters);
  if v_gk <> 1 then
    raise exception 'squad needs exactly one goalkeeper (has %)', v_gk;
  end if;
  if v_df < 1 then
    raise exception 'squad needs at least one defender';
  end if;
  if v_mf < 1 then
    raise exception 'squad needs at least one midfielder';
  end if;
  if v_fw < 1 then
    raise exception 'squad needs at least one forward';
  end if;

  -- Upsert the single active squad.
  select id into v_squad_id from public.squads where user_id = v_uid limit 1;
  if v_squad_id is null then
    insert into public.squads (user_id, name, total_cost)
    values (v_uid, p_name, v_cost)
    returning id into v_squad_id;
  else
    update public.squads
    set name = p_name, total_cost = v_cost, updated_at = now()
    where id = v_squad_id;
    delete from public.squad_slots where squad_id = v_squad_id;
  end if;

  v_slot := 0;
  foreach v_card in array p_starters loop
    insert into public.squad_slots (squad_id, card_id, slot)
    values (v_squad_id, v_card, v_slot);
    v_slot := v_slot + 1;
  end loop;

  return v_squad_id;
end;
$$;
