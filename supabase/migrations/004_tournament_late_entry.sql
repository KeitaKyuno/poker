ALTER TABLE public.tournament_entries
  ADD COLUMN IF NOT EXISTS starting_level integer NOT NULL DEFAULT 1;
