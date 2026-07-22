-- Two game modes replace the three difficulties: 'friendly' (learn the rules, no coins)
-- and 'competitive' (paid). The mode string is stored in the EXISTING free-text
-- `difficulty` column of match_sessions/matches — no schema change, since that column has
-- no CHECK/enum. Old history rows keep their 'easy'/'normal'/'hard' labels harmlessly.
--
-- record_match now pays 0 for a friendly match AND skips the wallet update + ledger row, so
-- a friendly game never moves coins; it is still recorded in match history (coins_awarded
-- = 0) for completeness. Otherwise identical to 0015 — same return shape (coins /
-- coins_awarded / match_id), so finish_match_session (0014) is unchanged. `create or
-- replace` preserves the existing grants (service_role only), same as 0015 relied on.

create or replace function public.record_match(
  p_uid            uuid,
  p_opponent       text,
  p_difficulty     text,
  p_result         match_result,
  p_gf             int,
  p_ga             int,
  p_squad_strength int,
  p_log            jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward   int;
  v_coins    bigint;
  v_match_id bigint;
begin
  if p_uid is null then
    raise exception 'record_match requires a user id';
  end if;

  -- Reward is defined server-side. A friendly match earns nothing; a competitive one pays
  -- by result. This RPC is the single source of truth for match coins.
  v_reward := case
    when p_difficulty = 'friendly' then 0
    when p_result = 'win'  then 100
    when p_result = 'draw' then 40
    else 10
  end;

  -- A zero reward (friendly) never touches the wallet or the ledger — a 0-coin transaction
  -- row would be noise that also wouldn't sum into the balance.
  if v_reward > 0 then
    update public.profiles set coins = coins + v_reward where id = p_uid;

    insert into public.transactions (user_id, amount, kind, ref)
    values (p_uid, v_reward, 'match_reward', p_result::text);
  end if;

  insert into public.matches
    (user_id, opponent_name, difficulty, result, goals_for, goals_against, coins_awarded, squad_strength, log)
  values
    (p_uid, p_opponent, p_difficulty, p_result, p_gf, p_ga, v_reward, p_squad_strength, coalesce(p_log, '[]'::jsonb))
  returning id into v_match_id;

  select coins into v_coins from public.profiles where id = p_uid;

  return jsonb_build_object('coins', v_coins, 'coins_awarded', v_reward, 'match_id', v_match_id);
end;
$$;
