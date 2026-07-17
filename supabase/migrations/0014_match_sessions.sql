-- Persisted interactive matches.
--
-- The interactive basic game (src/game/board/) is turn-based: ~100 authenticated
-- jugadas per match instead of the old one-shot simulate. Each jugada is an
-- authenticated call to the play-match Edge Function, which loads this row, validates
-- the action, rolls the dice server-side, applies one step and persists it back. The
-- browser never sends state back and never rolls a die — it sends an action id and the
-- server owns everything else, so the same anti-cheat posture as the one-shot path holds
-- across many round trips.
--
-- Authority mirrors matches (0002/0007): a client may READ its own sessions (a perfect-
-- information board game has nothing hidden to leak, and it makes resume-after-refresh
-- trivial), but there is NO client write policy at all — every mutation runs through the
-- Edge Function's service-role client, or the finish RPC below.

create table public.match_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  difficulty     text not null,
  status         text not null default 'active',
  seed           bigint not null,               -- the match seed; every die derives from it
  ply            int  not null default 0,        -- monotonic; RNG address + concurrency token
  state          jsonb not null,                 -- the serialized MatchState
  away_squad     jsonb not null,                 -- the generated opponent, frozen at start
  log            jsonb not null default '[]'::jsonb,
  squad_strength int  not null default 0,         -- summed starter cost, frozen (history parity)
  match_id       bigint references public.matches (id),  -- set once, at finish
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint match_sessions_status_check check (status in ('active', 'finished', 'abandoned'))
);

-- At most one live session per user: the anti-abuse spine. Starting a new match while one
-- is active must first resume or forfeit the old one — the server enforces one of the two
-- happened, and this index is the hard backstop.
create unique index match_sessions_one_active
  on public.match_sessions (user_id) where status = 'active';

create index match_sessions_user_idx on public.match_sessions (user_id, created_at desc);

-- RLS: read own only. No client write policy (see the header).
alter table public.match_sessions enable row level security;

create policy "read own match sessions" on public.match_sessions
  for select using (auth.uid() = user_id);

-- Like 0007, the SELECT policy only runs once the table-level privilege check passes, so
-- the read needs an explicit grant. No write grant to anon/authenticated: writes are the
-- Edge Function's (service_role) business, so a future policy slip still cannot expose a
-- client write path.
grant select on public.match_sessions to authenticated;

-- The Edge Function drives the reducer in TypeScript, so — unlike the money path, which
-- stays in a SECURITY DEFINER RPC — it reads and writes the session row directly as
-- service_role (which also bypasses RLS). service_role is a server-only secret never
-- handed to a client, so this grant is not a client-facing surface. No delete: a session
-- is only ever status-changed, never removed.
grant select, insert, update on public.match_sessions to service_role;

-- ============================================================
-- finish_match_session: pay + record + stamp, atomically.
--
-- Called ONLY by the play-match Edge Function (service_role) when a session reaches
-- fulltime (p_forfeit false) or the player resigns (p_forfeit true, recorded as a loss).
-- Locking the row and setting match_id inside the SAME transaction that pays is what makes
-- a win impossible to replay: a second call sees match_id already set and refuses before
-- record_match can pay twice.
-- ============================================================
create or replace function public.finish_match_session(
  p_uid        uuid,
  p_session_id uuid,
  p_forfeit    boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.match_sessions;
  v_home     int;
  v_away     int;
  v_result   match_result;
  v_opponent text;
  v_paid     jsonb;
begin
  -- Lock the session so two concurrent finishes serialise; the loser sees match_id set.
  select * into v_session from public.match_sessions where id = p_session_id for update;

  if not found then
    raise exception 'session not found';
  end if;
  if v_session.user_id <> p_uid then
    raise exception 'not your session';
  end if;
  -- Refuse a double-finish (replay-a-win): match_id is set below, in this transaction.
  if v_session.status <> 'active' or v_session.match_id is not null then
    raise exception 'session already finished';
  end if;
  -- A non-forfeit finish must be a genuinely over board — the client can't declare fulltime.
  if not p_forfeit and (v_session.state->'phase'->>'kind') <> 'fulltime' then
    raise exception 'match is not over';
  end if;

  -- `home` is always the human's side.
  v_home := coalesce((v_session.state->'score'->>'home')::int, 0);
  v_away := coalesce((v_session.state->'score'->>'away')::int, 0);
  -- A resignation is a loss whatever the scoreline — you can't rage-quit out of a defeat.
  v_result := case
    when p_forfeit          then 'loss'
    when v_home > v_away     then 'win'
    when v_home < v_away     then 'loss'
    else 'draw'
  end;
  v_opponent := coalesce(v_session.away_squad->>'name', 'Rival');

  -- record_match owns the reward table and the ledger/history inserts; it returns the
  -- inserted matches.id (0015), which we stamp back onto the session.
  v_paid := public.record_match(
    p_uid            => p_uid,
    p_opponent       => v_opponent,
    p_difficulty     => v_session.difficulty,
    p_result         => v_result,
    p_gf             => v_home,
    p_ga             => v_away,
    p_squad_strength => v_session.squad_strength,
    p_log            => v_session.log
  );

  update public.match_sessions
    set status     = case when p_forfeit then 'abandoned' else 'finished' end,
        match_id   = (v_paid->>'match_id')::bigint,
        updated_at = now()
    where id = p_session_id;

  return v_paid || jsonb_build_object('result', v_result, 'gf', v_home, 'ga', v_away);
end;
$$;

-- Same posture as record_match (0004): only the Edge Function (service_role) may finish.
revoke execute on function public.finish_match_session(uuid, uuid, boolean) from public;
revoke execute on function public.finish_match_session(uuid, uuid, boolean) from anon, authenticated;
grant  execute on function public.finish_match_session(uuid, uuid, boolean) to service_role;
