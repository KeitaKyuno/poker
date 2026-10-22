-- ランキング計算をゼロサム対称ポイント制に変更
-- 旧: 固定ポイントテーブル（1位+10, 2位+5, 3位+3...）
-- 新: points = entry_count - 2 * rank + 1
--     = (自分より下の人数) - (自分より上の人数)
-- 参加人数に関係なく試合ごとに自己完結するため、試合数によるポイント積み上げが無効化される。

begin;

drop view if exists public.v_tournament_ranking;
drop view if exists public.v_tournament_entry_points;

create view public.v_tournament_entry_points as
select
  tr.tournament_id,
  t.date as tournament_date,
  tr.player_id,
  tr.rank,
  count(*) over (partition by tr.tournament_id)::integer as entry_count,
  (
    count(*) over (partition by tr.tournament_id) - 2 * tr.rank + 1
  )::integer as points
from public.tournament_results tr
join public.tournaments t on t.id = tr.tournament_id
where t.status = 'finished';
-- entry_count は tournament_results 件数を採用。
-- 理由: /api/tournaments/[id]/results と /tournament/results は全参加者への順位入力を必須化し、
-- 登録後に tournaments.status を finished へ更新するため、finished 時点では results 件数 = entries 件数。
-- points 算出基準を rank 実体（results）側に揃えることで、ゼロサム（各大会合計0）が崩れない。

create view public.v_tournament_ranking as
select
  rank() over(order by sum(tep.points) desc)::integer as rank,
  tep.player_id,
  p.name as player_name,
  sum(tep.points)::integer as total_points,
  count(*)::integer as game_count
from public.v_tournament_entry_points tep
join public.players p on p.id = tep.player_id
group by tep.player_id, p.name;

commit;
