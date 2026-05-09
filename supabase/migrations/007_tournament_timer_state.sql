ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS timer_state jsonb;
