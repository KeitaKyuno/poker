-- セッション開始（sessions + buyins を1トランザクションで作成）
CREATE OR REPLACE FUNCTION create_session_with_buyin(
  p_player_id uuid,
  p_session_date date,
  p_session_idempotency_key uuid,
  p_buyin_amount integer,
  p_buyin_idempotency_key uuid
) RETURNS TABLE(
  session_id uuid,
  buyin_id uuid
) LANGUAGE plpgsql AS $$
BEGIN
  -- 同一プレイヤーの進行中セッションが既に存在する場合は拒否
  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE player_id = p_player_id AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SESSION: Player already has an in-progress session';
  END IF;

  IF p_buyin_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: buyin amount must be positive';
  END IF;

  INSERT INTO sessions(player_id, session_date, idempotency_key)
  VALUES (p_player_id, p_session_date, p_session_idempotency_key)
  RETURNING id INTO session_id;

  INSERT INTO buyins(session_id, entry_type, amount, idempotency_key)
  VALUES (session_id, 'initial', p_buyin_amount, p_buyin_idempotency_key)
  RETURNING id INTO buyin_id;

  RETURN NEXT;
END;
$$;
