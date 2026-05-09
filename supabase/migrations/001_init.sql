-- Extensions
create extension if not exists pgcrypto;

-- Enums
create type public.session_status as enum ('in_progress', 'closed');
create type public.buyin_entry_type as enum ('initial', 'reentry');

-- Updated at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- players
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_name_not_blank check (char_length(trim(name)) > 0)
);

create trigger trg_players_updated_at
before update on public.players
for each row execute function public.set_updated_at();

-- sessions
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  player_id uuid not null references public.players(id) on delete restrict,
  session_date date not null,
  total_cashout_amount integer,
  status public.session_status not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_total_cashout_non_negative check (total_cashout_amount is null or total_cashout_amount >= 0),
  constraint sessions_closed_fields_check check (
    (status = 'in_progress' and total_cashout_amount is null)
    or
    (status = 'closed' and total_cashout_amount is not null)
  )
);

create trigger trg_sessions_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

-- buyins
create table if not exists public.buyins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  entry_type public.buyin_entry_type not null,
  amount integer not null,
  idempotency_key uuid not null unique,
  recorded_at timestamptz not null default now(),
  constraint buyins_amount_positive check (amount > 0)
);

create index if not exists idx_sessions_player_date on public.sessions(player_id, session_date desc);
create index if not exists idx_sessions_status on public.sessions(status);
create index if not exists idx_buyins_session on public.buyins(session_id);
create index if not exists idx_buyins_idempotency_key on public.buyins(idempotency_key);

-- Session financial aggregate view
-- Source of truth for total_buyin_amount and net_profit is buyins aggregation only.
-- sessions table does not persist net_profit.
create or replace view public.v_session_buyin_totals as
select
  s.id as session_id,
  coalesce(sum(b.amount), 0)::integer as total_buyin_amount,
  case
    when s.total_cashout_amount is null then null
    else (s.total_cashout_amount - coalesce(sum(b.amount), 0))::integer
  end as net_profit
from public.sessions s
left join public.buyins b on b.session_id = s.id
group by s.id, s.total_cashout_amount;

-- Optional: ranking helper views (closed sessions only)
create or replace view public.v_monthly_ranking as
select
  to_char(s.session_date, 'YYYY-MM') as year_month,
  p.id as player_id,
  p.name as player_name,
  sum(v.net_profit)::integer as net_profit_sum,
  count(*)::integer as session_count
from public.sessions s
join public.players p on p.id = s.player_id
join public.v_session_buyin_totals v on v.session_id = s.id
where s.status = 'closed'
group by 1,2,3;

create or replace view public.v_overall_ranking as
select
  p.id as player_id,
  p.name as player_name,
  sum(v.net_profit)::integer as net_profit_sum,
  count(*)::integer as session_count
from public.sessions s
join public.players p on p.id = s.player_id
join public.v_session_buyin_totals v on v.session_id = s.id
where s.status = 'closed'
group by 1,2;
