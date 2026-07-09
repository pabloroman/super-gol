-- Super Gol — core schema
-- Entities: profiles (wallet), cards (catalog), user_cards (collection),
-- squads/squad_slots (the 16-player team), packs (store), matches, transactions (ledger).

-- ---------- enums ----------
create type card_rarity as enum ('comun', 'frecuente', 'rara');
create type match_result as enum ('win', 'loss', 'draw');

-- ---------- profiles (one per auth user; holds the wallet) ----------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique,
  coins      bigint not null default 0 check (coins >= 0),
  created_at timestamptz not null default now()
);

-- ---------- cards: the canonical catalog (the 481 Super Gol cards) ----------
create table public.cards (
  id           text primary key,          -- slug, e.g. 'simeone-atm'
  name         text not null,             -- display surname, e.g. 'SIMEONE'
  full_name    text,
  club         text,
  club_slug    text,
  nationality  text,
  birthplace   text,
  birth_date   date,
  height_cm    int,
  weight_kg    int,
  position     text,                      -- GK / DF / MF / FW (optional for now)
  cost         int not null check (cost >= 0),
  rarity       card_rarity not null default 'comun',
  is_starter   boolean not null default false,  -- part of the 55-card "juego básico"
  -- ratings: { rb, a, rc, d, rg, v, pc, pl, pa, dl }  (1..n per the card)
  abilities    jsonb not null default '{}'::jsonb,
  -- pitch-zone map: boolean[row][col], green cell = player is effective there
  zone_grid    jsonb not null default '[]'::jsonb,
  image_url    text,
  created_at   timestamptz not null default now()
);

create index cards_rarity_idx on public.cards (rarity);
create index cards_is_starter_idx on public.cards (is_starter) where is_starter;

-- ---------- user_cards: per-user collection with duplicates ----------
create table public.user_cards (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  card_id    text not null references public.cards (id) on delete cascade,
  quantity   int not null default 1 check (quantity >= 0),
  acquired_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create index user_cards_user_idx on public.user_cards (user_id);

-- ---------- squads: the matchday team (11 starters + 5 bench, <= 100 pts) ----------
create table public.squads (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null default 'Mi equipo',
  formation  text not null default '4-4-2',
  is_active  boolean not null default true,
  total_cost int not null default 0,
  updated_at timestamptz not null default now()
);

create index squads_user_idx on public.squads (user_id);

create table public.squad_slots (
  id         bigint generated always as identity primary key,
  squad_id   bigint not null references public.squads (id) on delete cascade,
  card_id    text not null references public.cards (id) on delete cascade,
  slot       int not null check (slot between 0 and 15), -- 0..10 starters, 11..15 bench
  is_starter boolean not null,
  unique (squad_id, slot)
);

-- ---------- packs: store products ----------
create table public.packs (
  id             text primary key,
  name           text not null,
  description    text,
  price          int not null check (price >= 0),
  card_count     int not null default 6 check (card_count > 0),
  -- weighted odds keyed by rarity, e.g. {"comun": 70, "frecuente": 25, "rara": 5}
  rarity_weights jsonb not null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------- matches: game history ----------
create table public.matches (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  opponent_name text not null,
  difficulty    text not null,
  result        match_result not null,
  goals_for     int not null,
  goals_against int not null,
  coins_awarded int not null default 0,
  squad_strength int,
  log           jsonb not null default '[]'::jsonb,  -- event feed for the match screen
  created_at    timestamptz not null default now()
);

create index matches_user_idx on public.matches (user_id, created_at desc);

-- ---------- transactions: append-only currency ledger ----------
create table public.transactions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     bigint not null,            -- signed: +earn / -spend
  kind       text not null,             -- starter_grant | match_reward | pack_purchase
  ref        text,
  created_at timestamptz not null default now()
);

create index transactions_user_idx on public.transactions (user_id, created_at desc);
