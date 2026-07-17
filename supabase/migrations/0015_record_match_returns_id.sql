-- record_match now returns the inserted matches.id alongside the coins.
--
-- The interactive match (0014) finishes a persisted session by paying through
-- record_match and then stamping that match's id back onto the session, inside one
-- transaction (see finish_match_session). To stamp it, the finish path needs the id
-- record_match created.
--
-- This is strictly ADDITIVE: the return type stays jsonb and still carries
-- `coins`/`coins_awarded`, so the legacy one-shot caller in the play-match Edge
-- Function keeps working unchanged. Only a new `match_id` field is added. The body is
-- otherwise identical to 0004 — the reward table and the ledger/history inserts are
-- unchanged.

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

  -- Reward is defined server-side, keyed off the result the engine returned.
  -- Mirrors REWARD in src/game/engine/index.ts (win / draw / loss).
  v_reward := case p_result
    when 'win'  then 100
    when 'draw' then 40
    else 10
  end;

  update public.profiles set coins = coins + v_reward where id = p_uid;

  insert into public.transactions (user_id, amount, kind, ref)
  values (p_uid, v_reward, 'match_reward', p_result::text);

  insert into public.matches
    (user_id, opponent_name, difficulty, result, goals_for, goals_against, coins_awarded, squad_strength, log)
  values
    (p_uid, p_opponent, p_difficulty, p_result, p_gf, p_ga, v_reward, p_squad_strength, coalesce(p_log, '[]'::jsonb))
  returning id into v_match_id;

  select coins into v_coins from public.profiles where id = p_uid;

  return jsonb_build_object('coins', v_coins, 'coins_awarded', v_reward, 'match_id', v_match_id);
end;
$$;

-- Grants are unchanged (0004): still service_role only. create-or-replace keeps them.
