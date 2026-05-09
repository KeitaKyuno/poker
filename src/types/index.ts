export type SessionStatus = 'in_progress' | 'closed';
export type BuyInEntryType = 'initial' | 'reentry';

export type Player = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  playerId: string;
  sessionDate: string; // YYYY-MM-DD
  totalBuyinAmount: number; // pt (integer, derived from buyins aggregate view)
  totalCashoutAmount: number | null; // pt (integer)
  netProfit: number | null; // pt (integer, derived value calculated from aggregate view)
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type BuyIn = {
  id: string;
  sessionId: string;
  entryType: BuyInEntryType;
  amount: number; // pt (integer)
  idempotencyKey: string; // UUID
  recordedAt: string;
};

export type MonthlyRanking = {
  rank: number;
  playerId: string;
  playerName: string;
  yearMonth: string; // YYYY-MM
  netProfitSum: number; // pt (integer)
  sessionCount: number;
};

export type OverallRanking = {
  rank: number;
  playerId: string;
  playerName: string;
  netProfitSum: number; // pt (integer)
  sessionCount: number;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

// /api/players
export type GetPlayersResponse = {
  players: Player[];
};

export type PostPlayersRequest = {
  name: string;
  pin: string; // 4-digit numeric string
};

export type PostPlayersResponse = {
  player: Player;
};

// /api/sessions
export type PostSessionsRequest = {
  playerId: string;
  pin: string; // 4-digit numeric string
  sessionDate: string; // YYYY-MM-DD
  initialBuyinAmount: number; // pt (integer, > 0)
  idempotencyKey: string; // UUID
};

export type PostSessionsResponse = {
  session: Session;
  buyin: BuyIn;
};

export type GetSessionsResponse = {
  sessions: Session[];
};

// /api/sessions/[sessionId]/buyins
export type PostSessionBuyinsRequest = {
  playerId: string;
  pin: string; // 4-digit numeric string
  amount: number; // pt (integer, > 0)
  idempotencyKey: string; // UUID
};

export type PostSessionBuyinsResponse = {
  session: Session;
  buyin: BuyIn;
};

// /api/buyins/[buyinId]
export type PatchBuyinRequest = {
  playerId: string;
  pin: string; // 4-digit numeric string
  amount: number; // pt (integer, > 0)
};

export type PatchBuyinResponse = {
  session: Session;
  buyin: BuyIn;
};

export type DeleteBuyinRequest = {
  playerId: string;
  pin: string; // 4-digit numeric string
};

export type DeleteBuyinResponse = {
  session: Session;
  deletedBuyinId: string;
};

// /api/sessions/[sessionId]/close
export type PostSessionCloseRequest = {
  playerId: string;
  pin: string; // 4-digit numeric string
  totalCashoutAmount: number; // pt (integer, >= 0)
};

export type PostSessionCloseResponse = {
  session: Session;
};

// /api/sessions/[sessionId]
export type PatchSessionRequest = {
  playerId: string;
  pin: string; // 4-digit numeric string
  sessionDate?: string; // YYYY-MM-DD
  status?: SessionStatus; // can be set back to in_progress
  totalCashoutAmount?: number | null; // pt (integer, >= 0) or null when reopening
};

export type PatchSessionResponse = {
  session: Session;
};

// /api/rankings/monthly?yearMonth=YYYY-MM
export type GetMonthlyRankingQuery = {
  yearMonth: string;
};

export type GetMonthlyRankingResponse = {
  rankings: MonthlyRanking[];
};

// /api/rankings/overall
export type GetOverallRankingResponse = {
  rankings: OverallRanking[];
};

// /api/players/[playerId]/stats
export type GetPlayerDailyStatsResponse = {
  stats: {
    date: string; // YYYY-MM-DD
    netProfit: number; // pt (integer)
  }[];
};

export type PlayerStatsPoint = {
  sessionDate: string; // YYYY-MM-DD
  netProfit: number; // pt (integer)
  cumulativeNetProfit: number; // pt (integer)
};

export type PlayerSessionHistoryItem = {
  sessionId: string;
  sessionDate: string; // YYYY-MM-DD
  totalBuyinAmount: number; // pt (integer)
  totalCashoutAmount: number; // pt (integer)
  netProfit: number; // pt (integer)
  status: 'closed';
};

export type GetPlayerStatsResponse = {
  player: Player;
  metrics: {
    sessionCount: number;
    netProfitSum: number; // pt (integer)
    averageProfitPerSession: number; // pt (integer rounded)
  };
  trend: PlayerStatsPoint[];
  sessions: PlayerSessionHistoryItem[];
};

// Form input values
export type PlayerRegistrationFormValues = {
  name: string;
  pin: string; // 4-digit numeric string
};

export type SessionStartFormValues = {
  playerId: string;
  pin: string; // 4-digit numeric string
  sessionDate: string; // YYYY-MM-DD
  initialBuyinAmount: number; // pt (integer, > 0)
  idempotencyKey: string; // UUID
};

export type BuyinEntryFormValues = {
  sessionId: string;
  playerId: string;
  pin: string; // 4-digit numeric string
  amount: number; // pt (integer, > 0)
  idempotencyKey: string; // UUID
};

export type SessionCloseFormValues = {
  sessionId: string;
  playerId: string;
  pin: string; // 4-digit numeric string
  totalCashoutAmount: number; // pt (integer, >= 0)
};

export type MonthlyRankingFilterFormValues = {
  yearMonth: string; // YYYY-MM
};

export type PlayerStatsFilterFormValues = {
  playerId: string;
};

export type TournamentBlind = {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  durationMinutes: number;
};

export type TournamentTimerState = {
  currentLevelIndex: number;
  currentLevelStartTimestamp: number;
  isPaused: boolean;
  pausedRemainingSeconds: number | null;
};

export type TournamentResult = {
  playerId: string;
  playerName: string;
  rank: number;
};

export type TournamentEntry = {
  playerId: string;
  playerName: string;
  startingLevel: number;
};

export type Tournament = {
  id: string;
  date: string;
  createdAt: string;
  entries: TournamentEntry[];
  blinds: TournamentBlind[];
  results: TournamentResult[];
  timerState: TournamentTimerState | null;
};

export type TournamentRanking = {
  rank: number;
  playerId: string;
  playerName: string;
  totalPoints: number;
  gameCount: number;
};

export type PostTournamentsRequest = {
  date: string;
  players: {
    playerId: string;
    startingLevel: number;
  }[];
  blinds: TournamentBlind[];
};

export type PostTournamentsResponse = {
  tournament: {
    id: string;
    date: string;
    createdAt: string;
  };
};

export type GetTournamentResponse = {
  tournament: Tournament;
};

export type PostTournamentResultsRequest = {
  results: {
    playerId: string;
    rank: number;
  }[];
};

export type PostTournamentResultsResponse = {
  results: {
    playerId: string;
    rank: number;
  }[];
};

export type GetTournamentRankingsResponse = {
  rankings: TournamentRanking[];
};

export type GetPlayerTournamentStatsResponse = {
  stats: {
    tournamentId: string;
    date: string;
    rank: number;
    points: number;
  }[];
};
