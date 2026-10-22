CREATE OR REPLACE FUNCTION public.parse_tournament_results(
  p_results jsonb
) RETURNS TABLE(
  player_id uuid,
  rank integer
) LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (item->>'playerId')::uuid AS player_id,
    (item->>'rank')::integer AS rank
  FROM jsonb_array_elements(p_results) item;
$$;

CREATE OR REPLACE FUNCTION submit_tournament_results(
  p_tournament_id uuid,
  p_results jsonb
) RETURNS TABLE(
  out_player_id uuid,
  out_rank integer
) LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_entry_count integer;
  v_result_count integer;
BEGIN
  -- Error code map (shared with src/lib/tournament-error-codes.ts):
  -- PT001 TOURNAMENT_NOT_FOUND
  -- PT002 RESULT_COUNT_MISMATCH
  -- PT003 INVALID_RESULTS_FORMAT
  -- PT004 INVALID_RANK_RANGE
  -- PT005 DUPLICATE_PLAYER
  -- PT006 DUPLICATE_RANK
  -- PT007 PLAYER_NOT_ENTERED
  -- PT008 INVALID_RANK_SEQUENCE
  -- NOTE: finished済み大会への順位再提出は、修正ページからの正規の訂正操作として許可する。

  IF NOT EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = p_tournament_id
  ) THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: Tournament does not exist'
      USING ERRCODE = 'PT001';
  END IF;

  IF jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_RESULTS_FORMAT: results must be an array'
      USING ERRCODE = 'PT003';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_results) item
    WHERE CASE
      WHEN jsonb_typeof(item) <> 'object' THEN true
      WHEN NOT (item ? 'playerId') THEN true
      WHEN NOT (item ? 'rank') THEN true
      WHEN jsonb_typeof(item->'playerId') <> 'string' THEN true
      WHEN jsonb_typeof(item->'rank') <> 'number' THEN true
      WHEN (item->>'rank') !~ '^[0-9]+$' THEN true
      ELSE false
    END
  ) THEN
    RAISE EXCEPTION 'INVALID_RESULTS_FORMAT: each result must have valid playerId(string) and rank(integer)'
      USING ERRCODE = 'PT003';
  END IF;

  WITH input_rows AS (
    SELECT i.player_id, i.rank
    FROM public.parse_tournament_results(p_results) i
  )
  SELECT count(*)::integer
  INTO v_result_count
  FROM input_rows;

  SELECT count(*)::integer
  INTO v_entry_count
  FROM public.tournament_entries te
  WHERE te.tournament_id = p_tournament_id;

  IF v_result_count <> v_entry_count THEN
    RAISE EXCEPTION 'RESULT_COUNT_MISMATCH: results count must match entries count'
      USING ERRCODE = 'PT002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parse_tournament_results(p_results) i
    WHERE i.rank <= 0
  ) THEN
    RAISE EXCEPTION 'INVALID_RANK_RANGE: rank must be positive integer'
      USING ERRCODE = 'PT004';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parse_tournament_results(p_results) i
    GROUP BY i.player_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PLAYER: playerId must be unique'
      USING ERRCODE = 'PT005';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parse_tournament_results(p_results) i
    GROUP BY i.rank
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_RANK: rank must be unique'
      USING ERRCODE = 'PT006';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parse_tournament_results(p_results) i
    LEFT JOIN public.tournament_entries te
      ON te.tournament_id = p_tournament_id
      AND te.player_id = i.player_id
    WHERE te.player_id IS NULL
  ) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ENTERED: all players must be tournament entries'
      USING ERRCODE = 'PT007';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM generate_series(1, v_entry_count) expected_rank
    LEFT JOIN public.parse_tournament_results(p_results) i
      ON i.rank = expected_rank
    WHERE i.rank IS NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_RANK_SEQUENCE: rank must be contiguous 1..N'
      USING ERRCODE = 'PT008';
  END IF;

  DELETE FROM public.tournament_results tr
  WHERE tr.tournament_id = p_tournament_id;

  INSERT INTO public.tournament_results(tournament_id, player_id, rank)
  SELECT
    p_tournament_id,
    i.player_id,
    i.rank
  FROM public.parse_tournament_results(p_results) i;

  UPDATE public.tournaments t
  SET status = 'finished'
  WHERE t.id = p_tournament_id;

  RETURN QUERY
  SELECT
    i.player_id AS out_player_id,
    i.rank AS out_rank
  FROM public.parse_tournament_results(p_results) i
  ORDER BY i.rank ASC;
END;
$$;
