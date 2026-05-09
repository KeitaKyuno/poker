create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_blinds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  level integer not null,
  sb integer not null,
  bb integer not null,
  ante integer not null default 0,
  duration_minutes integer not null,
  unique(tournament_id, level)
);

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.players(id),
  unique(tournament_id, player_id)
);

create table if not exists public.tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.players(id),
  rank integer not null check(rank >= 1),
  unique(tournament_id, player_id)
);

create trigger trg_tournaments_updated_at
before update on public.tournaments
for each row execute function public.set_updated_at();

alter table public.tournaments enable row level security;
alter table public.tournament_blinds enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_results enable row level security;

create or replace view public.v_tournament_ranking as
with entry_counts as (
  select
    tournament_id,
    count(*)::integer as entry_count
  from public.tournament_entries
  group by tournament_id
),
scored as (
  select
    tr.player_id,
    p.name as player_name,
    tr.tournament_id,
    tr.rank,
    ec.entry_count,
    case
      when tr.rank = 1 then 10
      when tr.rank = 2 then 5
      when tr.rank = 3 and ec.entry_count >= 3 then 3
      when tr.rank = 4 and ec.entry_count >= 6 then 2
      when tr.rank = 5 and ec.entry_count >= 8 then 1
      else 0
    end::integer as points
  from public.tournament_results tr
  join public.players p on p.id = tr.player_id
  join entry_counts ec on ec.tournament_id = tr.tournament_id
)
select
  rank() over(order by sum(points) desc, player_name asc)::integer as rank,
  player_id,
  player_name,
  sum(points)::integer as total_points,
  count(*)::integer as game_count
from scored
group by player_id, player_name
order by total_points desc, player_name asc;
