ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_date_unique UNIQUE (date);
