-- Row Level Security.
-- Principle: clients may READ their own rows (and the public catalog), but every
-- WRITE that touches the economy or game state goes through a SECURITY DEFINER
-- RPC (see 0003_functions.sql). That makes coins, pack pulls and results
-- impossible to forge from the client.

alter table public.profiles     enable row level security;
alter table public.cards        enable row level security;
alter table public.user_cards   enable row level security;
alter table public.squads       enable row level security;
alter table public.squad_slots  enable row level security;
alter table public.packs        enable row level security;
alter table public.matches      enable row level security;
alter table public.transactions enable row level security;

-- Public catalog: anyone (incl. anon) may read cards and packs.
create policy "cards are public" on public.cards
  for select using (true);

create policy "packs are public" on public.packs
  for select using (true);

-- Profiles: read only your own. No client UPDATE (coins are RPC-only).
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Collection: read only your own.
create policy "read own cards" on public.user_cards
  for select using (auth.uid() = user_id);

-- Squads: read only your own.
create policy "read own squads" on public.squads
  for select using (auth.uid() = user_id);

create policy "read own squad slots" on public.squad_slots
  for select using (
    exists (
      select 1 from public.squads s
      where s.id = squad_slots.squad_id and s.user_id = auth.uid()
    )
  );

-- Matches & ledger: read only your own.
create policy "read own matches" on public.matches
  for select using (auth.uid() = user_id);

create policy "read own transactions" on public.transactions
  for select using (auth.uid() = user_id);
