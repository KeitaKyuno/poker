create unique index if not exists sessions_one_in_progress_per_player_idx
  on sessions (player_id)
  where status = 'in_progress';
