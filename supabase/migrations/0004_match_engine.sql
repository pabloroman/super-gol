-- Move match resolution to the real engine.
--
-- The basic-game rules (seeded d6 + ability + marcaje) now run inside the
-- `play-match` Supabase Edge Function (supabase/functions/play-match/), which
-- resolves the match in TypeScript and then calls `record_match` below to commit
-- the outcome. The old `play_match` placeholder — which faked a scoreline from
-- summed squad cost — is dropped.
--
-- Authority: the Edge Function runs the engine server-side and calls
-- `record_match` with the service-role key. `record_match` is REVOKED from the
-- client roles (anon/authenticated) and granted only to `service_role`, so a
-- browser can trigger a match but can never forge a result or the coins it pays.

-- ============================================================
-- record_match: commit an already-resolved match (award coins, record history).
-- Called ONLY by the play-match Edge Function (service_role). Returns
-- { coins, coins_awarded }.
-- ============================================================
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
  v_reward int;
  v_coins  bigint;
begin
  if p_uid is null then
    raise exception 'record_match requires a user id';
  end if;

  -- Reward is defined server-side, keyed off the result (win / draw / loss); this RPC is
  -- the single source of truth for match coins.
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
    (p_uid, p_opponent, p_difficulty, p_result, p_gf, p_ga, v_reward, p_squad_strength, coalesce(p_log, '[]'::jsonb));

  select coins into v_coins from public.profiles where id = p_uid;

  return jsonb_build_object('coins', v_coins, 'coins_awarded', v_reward);
end;
$$;

-- Only the Edge Function (service_role) may commit a match result.
revoke execute on function public.record_match(uuid, text, text, match_result, int, int, int, jsonb) from public;
revoke execute on function public.record_match(uuid, text, text, match_result, int, int, int, jsonb) from anon, authenticated;
grant  execute on function public.record_match(uuid, text, text, match_result, int, int, int, jsonb) to service_role;

-- The placeholder resolver is gone; resolution lives in the play-match Edge Function.
drop function if exists public.play_match(text);
