-- Ensure no tied ranks per tournament at DB level.
-- Safe rollout note:
-- Before applying on production, verify there are no duplicates with:
-- SELECT tournament_id, rank, COUNT(*)
-- FROM public.tournament_results
-- GROUP BY tournament_id, rank
-- HAVING COUNT(*) > 1;
-- If rows are returned, clean up duplicates first, then apply this migration.

alter table public.tournament_results
  add constraint tournament_results_tournament_id_rank_key
  unique (tournament_id, rank);
