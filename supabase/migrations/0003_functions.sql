-- Server-authoritative game logic.
-- Everything that grants cards, moves coins, or decides a result lives here as
-- SECURITY DEFINER functions, so the client can *call* them but never forge them.

-- ============================================================
-- New user: create profile, grant starting coins + the basic-game cards.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_coins constant bigint := 500;
begin
  insert into public.profiles (id, username, coins)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'Entrenador'),
    v_start_coins
  );

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- open_pack: charge coins, roll cards by rarity weights, grant them.
-- Returns { coins, cards: [card_id, ...] }.
-- ============================================================
create or replace function public.open_pack(p_pack_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_pack       public.packs%rowtype;
  v_coins      bigint;
  v_keys       text[];
  v_weights    numeric[];
  v_total_w    numeric;
  v_roll       numeric;
  v_acc        numeric;
  v_rarity     card_rarity;
  v_card_id    text;
  v_result     text[] := '{}';
  i            int;
  k            int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_pack from public.packs where id = p_pack_id;
  if not found then
    raise exception 'unknown pack %', p_pack_id;
  end if;

  -- Lock the wallet row to avoid double-spend under concurrency.
  select coins into v_coins from public.profiles where id = v_uid for update;
  if v_coins < v_pack.price then
    raise exception 'insufficient funds';
  end if;

  update public.profiles set coins = coins - v_pack.price where id = v_uid;

  insert into public.transactions (user_id, amount, kind, ref)
  values (v_uid, -v_pack.price, 'pack_purchase', p_pack_id);

  -- Unpack rarity weights into parallel arrays.
  select array_agg(key), array_agg(value::numeric)
    into v_keys, v_weights
  from jsonb_each_text(v_pack.rarity_weights);

  v_total_w := 0;
  foreach v_roll in array v_weights loop
    v_total_w := v_total_w + v_roll;
  end loop;

  for i in 1 .. v_pack.card_count loop
    -- Weighted rarity pick.
    v_roll := random() * v_total_w;
    v_acc := 0;
    v_rarity := 'comun';
    for k in 1 .. array_length(v_keys, 1) loop
      v_acc := v_acc + v_weights[k];
      if v_roll <= v_acc then
        v_rarity := v_keys[k]::card_rarity;
        exit;
      end if;
    end loop;

    -- Random card of that rarity (fall back to any if the tier is empty).
    select id into v_card_id
    from public.cards where rarity = v_rarity
    order by random() limit 1;

    if v_card_id is null then
      select id into v_card_id from public.cards order by random() limit 1;
    end if;

    insert into public.user_cards (user_id, card_id, quantity)
    values (v_uid, v_card_id, 1)
    on conflict (user_id, card_id)
    do update set quantity = public.user_cards.quantity + 1;

    v_result := array_append(v_result, v_card_id);
  end loop;

  select coins into v_coins from public.profiles where id = v_uid;

  return jsonb_build_object('coins', v_coins, 'cards', to_jsonb(v_result));
end;
$$;

-- ============================================================
-- save_squad: validate ownership, count, and the 100-point cap, then persist.
-- Foundation keeps a single active squad per user.
-- ============================================================
create or replace function public.save_squad(
  p_name      text,
  p_formation text,
  p_starters  text[],
  p_bench     text[]
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_all       text[];
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

  if coalesce(array_length(p_bench, 1), 0) > 5 then
    raise exception 'the bench holds at most 5 players';
  end if;

  v_all := p_starters || coalesce(p_bench, '{}');

  -- No player twice.
  if (select count(distinct x) from unnest(v_all) x) <> array_length(v_all, 1) then
    raise exception 'a player cannot appear twice in the squad';
  end if;

  -- Must own every listed card.
  foreach v_card in array v_all loop
    if not exists (
      select 1 from public.user_cards
      where user_id = v_uid and card_id = v_card and quantity > 0
    ) then
      raise exception 'you do not own card %', v_card;
    end if;
  end loop;

  -- 100-point cap.
  select coalesce(sum(cost), 0) into v_cost
  from public.cards where id = any (v_all);
  if v_cost > 100 then
    raise exception 'squad costs % points (max 100)', v_cost;
  end if;

  -- Upsert the single active squad.
  select id into v_squad_id from public.squads where user_id = v_uid limit 1;
  if v_squad_id is null then
    insert into public.squads (user_id, name, formation, total_cost)
    values (v_uid, p_name, p_formation, v_cost)
    returning id into v_squad_id;
  else
    update public.squads
    set name = p_name, formation = p_formation, total_cost = v_cost, updated_at = now()
    where id = v_squad_id;
    delete from public.squad_slots where squad_id = v_squad_id;
  end if;

  v_slot := 0;
  foreach v_card in array p_starters loop
    insert into public.squad_slots (squad_id, card_id, slot, is_starter)
    values (v_squad_id, v_card, v_slot, true);
    v_slot := v_slot + 1;
  end loop;

  v_slot := 11;
  if p_bench is not null then
    foreach v_card in array p_bench loop
      insert into public.squad_slots (squad_id, card_id, slot, is_starter)
      values (v_squad_id, v_card, v_slot, false);
      v_slot := v_slot + 1;
    end loop;
  end if;

  return v_squad_id;
end;
$$;

-- ============================================================
-- play_match: PLACEHOLDER resolver (server-authoritative).
-- Resolves a match vs an AI opponent from squad strength + randomness,
-- awards coins, records history. The real d6+ability+zones engine will
-- replace the body of this function (or move to an Edge Function) later.
-- ============================================================
create or replace function public.play_match(p_difficulty text default 'normal')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_squad_id   bigint;
  v_strength   int;
  v_opp_name   text;
  v_opp_str    int;
  v_gf         int := 0;
  v_ga         int := 0;
  v_log        jsonb := '[]'::jsonb;
  v_result     match_result;
  v_reward     int;
  v_chances    int := 5;
  v_p_for      numeric;
  v_p_against  numeric;
  i            int;
  scored       boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_squad_id from public.squads where user_id = v_uid order by is_active desc limit 1;
  if v_squad_id is null then
    raise exception 'you have no squad yet';
  end if;

  -- Strength = summed cost of the 11 starters (placeholder proxy for ratings).
  select coalesce(sum(c.cost), 0) into v_strength
  from public.squad_slots ss
  join public.cards c on c.id = ss.card_id
  where ss.squad_id = v_squad_id and ss.is_starter;

  if v_strength = 0 then
    raise exception 'your squad has no starters';
  end if;

  -- Opponent scaled by difficulty.
  case p_difficulty
    when 'easy'   then v_opp_str := 45; v_opp_name := 'CF Domingueros';
    when 'hard'   then v_opp_str := 80; v_opp_name := 'Real Elite CF';
    else               v_opp_str := 62; v_opp_name := 'Atlético Medio';
  end case;

  -- Per-chance scoring probability from the strength differential.
  v_p_for     := greatest(0.08, least(0.60, 0.20 + (v_strength - v_opp_str)::numeric / 300));
  v_p_against := greatest(0.08, least(0.60, 0.20 + (v_opp_str - v_strength)::numeric / 300));

  for i in 1 .. v_chances loop
    scored := random() < v_p_for;
    if scored then v_gf := v_gf + 1; end if;
    v_log := v_log || jsonb_build_object(
      'minute', i * 18 - 5, 'side', 'home',
      'text', case when scored then '¡GOL nuestro!' else 'Ocasión desperdiciada' end
    );

    scored := random() < v_p_against;
    if scored then v_ga := v_ga + 1; end if;
    v_log := v_log || jsonb_build_object(
      'minute', i * 18, 'side', 'away',
      'text', case when scored then 'Gol del rival' else 'Paramos el ataque' end
    );
  end loop;

  if v_gf > v_ga then
    v_result := 'win';  v_reward := 100;
  elsif v_gf < v_ga then
    v_result := 'loss'; v_reward := 10;
  else
    v_result := 'draw'; v_reward := 40;
  end if;

  update public.profiles set coins = coins + v_reward where id = v_uid;

  insert into public.transactions (user_id, amount, kind, ref)
  values (v_uid, v_reward, 'match_reward', v_result::text);

  insert into public.matches
    (user_id, opponent_name, difficulty, result, goals_for, goals_against, coins_awarded, squad_strength, log)
  values
    (v_uid, v_opp_name, p_difficulty, v_result, v_gf, v_ga, v_reward, v_strength, v_log);

  return jsonb_build_object(
    'result', v_result,
    'opponent', v_opp_name,
    'goals_for', v_gf,
    'goals_against', v_ga,
    'coins_awarded', v_reward,
    'log', v_log
  );
end;
$$;
