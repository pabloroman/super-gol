-- Trim the squad to what the juego básico actually has: 11 cards, nothing else.
--
-- Two concepts go, neither of which the rulebook grants the basic game.
--
-- 1. THE BENCH. MODALIDAD DE JUEGO BÁSICO (page 12) reads «Se juega con 10
--    jugadores de campo + 1 portero por cada equipo», and the worked example on
--    page 13 («Se juega con reglamento básico») fields exactly 11 a side with no
--    reserves. Substitutes are a REGLA AVANZADA — page 28: «Los equipos constarán
--    de 16 jugadores (2 porteros y 14 de campo). Se podrán efectuar 3 cambios» —
--    and page 18 on is out of scope for this engine.
--
--    In code the bench was write-only: save_squad persisted slots 11..15, but
--    every reader filtered them out (buildEngineSquad, play_match's strength sum).
--    Its one live effect was a trap — bench cards counted against the 100-point
--    cap, so benching a player silently spent points that bought nothing.
--
-- 2. THE FORMATION. The rulebook has no such concept: neither «formación» nor
--    «4-4-2» appears anywhere in it. What it has is «colocación inicial de los
--    jugadores en el campo» (page 4) — real squares on a 6x5 board, which the
--    engine abstracts behind the Pitch interface. A formation string is football-
--    manager idiom borrowed from outside the game; the client only ever wrote the
--    hard-coded '4-4-2' back, and nothing but Home read it. Should the real board
--    land later, colocación is what it needs, and this column would not help.

-- Drop the reserves. Nothing reads them, so nothing is lost but the row.
delete from public.squad_slots where not is_starter;

-- The cap was summed over starters AND bench (0003), so every squad that carried
-- reserves has an inflated total_cost. Recompute from what survives — otherwise
-- the builder keeps charging users for players that no longer exist.
update public.squads s
set total_cost = coalesce((
  select sum(c.cost)
  from public.squad_slots ss
  join public.cards c on c.id = ss.card_id
  where ss.squad_id = s.id
), 0);

alter table public.squad_slots drop column is_starter;
alter table public.squads drop column formation;

-- squad_slots_slot_check is the inline `check (slot between 0 and 15)` from
-- 0001; Postgres auto-named it. 0..10 is now the whole squad.
alter table public.squad_slots
  drop constraint squad_slots_slot_check,
  add constraint squad_slots_slot_check check (slot between 0 and 10);

-- Drop the old overload rather than leaving it beside the new signature:
-- PostgREST resolves rpc('save_squad') by argument names, and two candidates
-- would make the call ambiguous.
drop function public.save_squad(text, text, text[], text[]);

-- ============================================================
-- save_squad: validate ownership, count, and the 100-point cap, then persist.
-- Foundation keeps a single active squad per user.
-- ============================================================
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

  -- 100-point cap.
  select coalesce(sum(cost), 0) into v_cost
  from public.cards where id = any (p_starters);
  if v_cost > 100 then
    raise exception 'squad costs % points (max 100)', v_cost;
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
