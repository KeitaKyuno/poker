-- 008 適用前と適用後の両方で実行し、0件であることを確認する。
-- Returns only invalid tournaments that violate any of:
-- (a) finished tournaments must sum to 0 points,
-- (b) ranks must be contiguous 1..N,
-- (c) tournament_entries count must equal tournament_results count.

with finished_tournaments as (
  select id, date
  from public.tournaments
  where status = 'finished'
),
result_points as (
  select
    tr.tournament_id,
    tr.rank,
    count(*) over (partition by tr.tournament_id)::integer as entry_count
  from public.tournament_results tr
  join public.tournaments t on t.id = tr.tournament_id
  where t.status = 'finished'
),
result_agg as (
  select
    rp.tournament_id,
    count(*)::integer as results_count,
    sum((rp.entry_count - 2 * rp.rank + 1))::integer as points_sum,
    min(rp.rank)::integer as min_rank,
    max(rp.rank)::integer as max_rank,
    count(distinct rp.rank)::integer as distinct_rank_count
  from result_points rp
  group by rp.tournament_id
),
entry_agg as (
  select
    te.tournament_id,
    count(*)::integer as entries_count
  from public.tournament_entries te
  join finished_tournaments ft on ft.id = te.tournament_id
  group by te.tournament_id
)
select
  ft.id as tournament_id,
  ft.date as tournament_date,
  coalesce(ea.entries_count, 0) as entries_count,
  coalesce(ra.results_count, 0) as results_count,
  coalesce(ra.points_sum, 0) as points_sum,
  case
    when ra.tournament_id is null then false
    else ra.min_rank = 1
      and ra.max_rank = ra.results_count
      and ra.distinct_rank_count = ra.results_count
  end as is_rank_contiguous_1_to_n,
  (coalesce(ea.entries_count, 0) = coalesce(ra.results_count, 0)) as is_entries_results_matched,
  (coalesce(ra.points_sum, 0) = 0) as is_points_sum_zero
from finished_tournaments ft
left join result_agg ra on ra.tournament_id = ft.id
left join entry_agg ea on ea.tournament_id = ft.id
where not (
  coalesce(ra.points_sum, 0) = 0
  and ra.tournament_id is not null
  and ra.min_rank = 1
  and ra.max_rank = ra.results_count
  and ra.distinct_rank_count = ra.results_count
  and coalesce(ea.entries_count, 0) = coalesce(ra.results_count, 0)
)
order by ft.date asc, ft.id asc;
