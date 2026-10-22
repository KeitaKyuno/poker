CREATE OR REPLACE FUNCTION public.block_tournament_entries_on_finished()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_deleting_tournament_ids text;
BEGIN
  -- Error code map (shared with src/lib/tournament-error-codes.ts):
  -- PT009 TOURNAMENT_FINISHED_ENTRIES_LOCKED

  -- NOTE:
  -- finished大会の entries は通常 DML を常にブロックする。
  -- ただし tournaments 削除に伴う FK の ON DELETE CASCADE 由来の DELETE のみ許可する。
  -- pg_trigger_depth() は実行環境差異で安定しないため使わず、明示的に判定する:
  -- 1) tournaments の BEFORE DELETE トリガーで、削除対象ID集合を TX ローカル GUC
  --    `poker.deleting_tournament_ids` に追記して記録する。
  -- 2) entries 側では DELETE 時のみ current_setting(..., true) を参照し、
  --    OLD.tournament_id が集合に含まれる場合だけ許可する。
  IF TG_OP = 'DELETE' THEN
    v_deleting_tournament_ids := current_setting('poker.deleting_tournament_ids', true);
    IF NULLIF(v_deleting_tournament_ids, '') IS NOT NULL
      AND OLD.tournament_id = ANY(string_to_array(v_deleting_tournament_ids, ',')::uuid[])
    THEN
      RETURN OLD;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = OLD.tournament_id
        AND t.status = 'finished'
    ) THEN
      RAISE EXCEPTION 'TOURNAMENT_FINISHED: finished tournament entries cannot be modified'
        USING ERRCODE = 'PT009';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = NEW.tournament_id
        AND t.status = 'finished'
    ) THEN
      RAISE EXCEPTION 'TOURNAMENT_FINISHED: finished tournament entries cannot be modified'
        USING ERRCODE = 'PT009';
    END IF;

    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id IN (OLD.tournament_id, NEW.tournament_id)
      AND t.status = 'finished'
  ) THEN
    RAISE EXCEPTION 'TOURNAMENT_FINISHED: finished tournament entries cannot be modified'
      USING ERRCODE = 'PT009';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_deleting_tournament_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_deleting_tournament_ids text;
BEGIN
  v_deleting_tournament_ids := current_setting('poker.deleting_tournament_ids', true);
  PERFORM set_config(
    'poker.deleting_tournament_ids',
    concat_ws(',', NULLIF(v_deleting_tournament_ids, ''), OLD.id::text),
    true
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_tournament_entries_on_finished ON public.tournament_entries;
DROP TRIGGER IF EXISTS trg_mark_deleting_tournament_id ON public.tournaments;

CREATE TRIGGER trg_mark_deleting_tournament_id
BEFORE DELETE ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.mark_deleting_tournament_id();

CREATE TRIGGER trg_block_tournament_entries_on_finished
BEFORE INSERT OR UPDATE OR DELETE ON public.tournament_entries
FOR EACH ROW
EXECUTE FUNCTION public.block_tournament_entries_on_finished();
