# ポーカーキャッシュゲームランキングツール Phase 2 アーキテクチャ設計

## 1. システム全体構成図（ASCII）
```text
+--------------------+           HTTPS            +-----------------------------+
|  Browser (Mobile/PC)|  <--------------------->  | Next.js on Vercel           |
|  - Next.js UI       |                           | - App Router (RSC/Client)   |
|  - shadcn/ui         |                           | - Route Handlers (/api/*)   |
|  - Recharts          |                           | - Server-side validation     |
+--------------------+                           +--------------+--------------+
                                                               |
                                                               | Supabase JS Client
                                                               v
                                              +-----------------------------------+
                                              | Supabase (PostgreSQL)             |
                                              | - players                          |
                                              | - sessions                         |
                                              | - buyins                           |
                                              | - views/functions for rankings     |
                                              +-----------------------------------+
```

## 2. ディレクトリ構成
```text
poker/
├─ app/
│  ├─ (public)/
│  │  ├─ ranking/
│  │  │  ├─ monthly/page.tsx
│  │  │  └─ overall/page.tsx
│  │  └─ players/[playerId]/page.tsx
│  ├─ (write)/
│  │  ├─ players/new/page.tsx
│  │  ├─ sessions/start/page.tsx
│  │  ├─ sessions/buyin/page.tsx
│  │  └─ sessions/close/page.tsx
│  └─ api/
│     ├─ players/route.ts
│     ├─ sessions/route.ts
│     ├─ sessions/[sessionId]/route.ts
│     ├─ sessions/[sessionId]/buyins/route.ts
│     ├─ sessions/[sessionId]/close/route.ts
│     ├─ buyins/[buyinId]/route.ts
│     ├─ rankings/monthly/route.ts
│     ├─ rankings/overall/route.ts
│     └─ players/[playerId]/stats/route.ts
├─ components/
│  ├─ ui/                     # shadcn/ui
│  ├─ forms/
│  └─ charts/
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts
│  │  └─ server.ts
│  ├─ auth/
│  │  └─ pin.ts               # 4桁PIN検証(bcrypt)
│  ├─ validation/
│  └─ ranking/
├─ docs/
│  ├─ requirements.md
│  ├─ architecture.md
│  └─ interfaces.ts
└─ supabase/
   └─ migrations/
```

## 3. データフロー（ユーザー操作 → UI → API → DB）

### 3.1 プレイヤー登録
1. ユーザーがUIで「名前 + 4桁パスワード」を入力。
2. UIが `POST /api/players` を送信。
3. APIで入力バリデーション（名前重複、4桁数字）実施。
4. APIで `bcrypt` によりPINをハッシュ化。
5. `players` に保存し、レスポンスは `password_hash` を除外。

### 3.2 セッション開始・リエントリー
1. ユーザーがプレイヤー選択、PIN、日付、バイイン額を入力。
2. UIが `POST /api/sessions`（開始）または `POST /api/sessions/{id}/buyins`（追加入力）を送信。
3. APIでPIN照合（書き込み操作時のみ）。
4. セッション開始は Supabase RPC（`create_session_with_initial_buyin` 想定）で `sessions` 作成 + 初回 `buyins` 登録を1トランザクションで実行する。
5. リエントリー追加は `buyins` に `idempotency_key` 付きで登録し、二重登録を防止する。
6. `total_buyin_amount` と `net_profit` は `buyins` 集計View（`v_session_buyin_totals`）から算出し、更新後セッションを返却する。

### 3.3 セッション終了
1. ユーザーがプレイヤー、PIN、最終獲得額を入力。
2. UIが `POST /api/sessions/{id}/close` を送信。
3. APIでPIN照合後、`POST /api/sessions/[id]/close` の処理は Supabase RPC（`close_session` 関数想定）でアトミックに実行する。
4. RPC内で `sessions.total_cashout_amount` と `sessions.status=closed` を更新し、`net_profit` は `v_session_buyin_totals` から派生値として扱う。
5. ランキング対象データとして確定。

### 3.4 ランキング閲覧
1. ユーザーが月次/総合ランキング画面を開く（認証不要）。
2. UIが `GET /api/rankings/monthly?yearMonth=YYYY-MM` または `GET /api/rankings/overall` を呼び出す。
3. APIが `closed` セッションのみ集計。
4. 並び順は `net_profit DESC`、同率時は `player_name ASC`（五十音順）で返却。

## 4. Supabase テーブル定義（SQL DDL）
```sql
-- Extensions
create extension if not exists pgcrypto;

-- Enums
create type public.session_status as enum ('in_progress', 'closed');
create type public.buyin_entry_type as enum ('initial', 'reentry');

-- Updated at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- players
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_name_not_blank check (char_length(trim(name)) > 0)
);

create trigger trg_players_updated_at
before update on public.players
for each row execute function public.set_updated_at();

-- sessions
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  player_id uuid not null references public.players(id) on delete restrict,
  session_date date not null,
  total_cashout_amount integer,
  status public.session_status not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_total_cashout_non_negative check (total_cashout_amount is null or total_cashout_amount >= 0),
  constraint sessions_closed_fields_check check (
    (status = 'in_progress' and total_cashout_amount is null)
    or
    (status = 'closed' and total_cashout_amount is not null)
  )
);

create trigger trg_sessions_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

-- buyins
create table if not exists public.buyins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  entry_type public.buyin_entry_type not null,
  amount integer not null,
  idempotency_key uuid not null unique,
  recorded_at timestamptz not null default now(),
  constraint buyins_amount_positive check (amount > 0)
);

create index if not exists idx_sessions_player_date on public.sessions(player_id, session_date desc);
create index if not exists idx_sessions_status on public.sessions(status);
create index if not exists idx_buyins_session on public.buyins(session_id);
create index if not exists idx_buyins_idempotency_key on public.buyins(idempotency_key);

-- Session financial aggregate view
-- Source of truth for total_buyin_amount and net_profit is buyins aggregation only.
-- sessions table does not persist net_profit.
create or replace view public.v_session_buyin_totals as
select
  s.id as session_id,
  coalesce(sum(b.amount), 0)::integer as total_buyin_amount,
  case
    when s.total_cashout_amount is null then null
    else (s.total_cashout_amount - coalesce(sum(b.amount), 0))::integer
  end as net_profit
from public.sessions s
left join public.buyins b on b.session_id = s.id
group by s.id, s.total_cashout_amount;

-- Optional: ranking helper views (closed sessions only)
create or replace view public.v_monthly_ranking as
select
  to_char(s.session_date, 'YYYY-MM') as year_month,
  p.id as player_id,
  p.name as player_name,
  sum(v.net_profit)::integer as net_profit_sum,
  count(*)::integer as session_count
from public.sessions s
join public.players p on p.id = s.player_id
join public.v_session_buyin_totals v on v.session_id = s.id
where s.status = 'closed'
group by 1,2,3;

create or replace view public.v_overall_ranking as
select
  p.id as player_id,
  p.name as player_name,
  sum(v.net_profit)::integer as net_profit_sum,
  count(*)::integer as session_count
from public.sessions s
join public.players p on p.id = s.player_id
join public.v_session_buyin_totals v on v.session_id = s.id
where s.status = 'closed'
group by 1,2;
```

## 5. API Routes 一覧（Next.js App Router形式）

| Route | Method | 説明 |
|---|---|---|
| `/api/players` | `GET` | プレイヤー一覧取得（公開情報のみ、`password_hash` は返さない） |
| `/api/players` | `POST` | プレイヤー新規登録（名前 + 4桁PIN、PINはbcryptハッシュ化保存） |
| `/api/sessions` | `POST` | セッション開始（初回バイイン登録含む、PIN検証必須、`idempotencyKey` 必須） |
| `/api/sessions/[sessionId]/buyins` | `POST` | リエントリー追加（PIN検証必須、`idempotencyKey` 必須、`status=in_progress` のセッションのみ受け付ける。`status=closed` の場合は `422`） |
| `/api/buyins/[buyinId]` | `PATCH` | バイイン額修正（PIN検証必須。親セッションが `closed` の場合は一旦 `PATCH /api/sessions/[sessionId]` で `status=in_progress` に戻してから操作） |
| `/api/buyins/[buyinId]` | `DELETE` | バイイン削除（PIN検証必須。親セッションが `closed` の場合は一旦 `PATCH /api/sessions/[sessionId]` で `status=in_progress` に戻してから操作） |
| `/api/sessions/[sessionId]` | `PATCH` | セッション情報修正（cashout修正含む、`status` を `in_progress` に戻す操作可、PIN検証必須） |
| `/api/sessions/[sessionId]/close` | `POST` | セッション終了（最終獲得額入力、純利益確定、PIN検証必須） |
| `/api/rankings/monthly` | `GET` | 月次ランキング取得（`yearMonth=YYYY-MM`） |
| `/api/rankings/overall` | `GET` | 総合ランキング取得 |
| `/api/players/[playerId]/stats` | `GET` | プレイヤー詳細指標・推移データ取得（参加回数、純利益合計、平均、履歴） |

### 並び順ルール（ランキング共通）
1. `net_profit_sum DESC`
2. `player_name ASC`（五十音順）

### 認証ルール
- `GET` 系閲覧APIは認証不要。
- 書き込み系（`POST`/`PATCH`/`DELETE`）はプレイヤー選択 + 4桁PIN検証必須。
- PINや `password_hash` はレスポンスに含めない。

## 6. セキュリティ設計
- 書き込みAPI（`POST`/`PATCH`/`DELETE`）はIPアドレス単位でレートリミットを適用し、上限は `60回/分` とする。
- PIN検証エンドポイントはIPアドレス単位でより厳格なレートリミットを適用し、上限は `10回/分` とする。
- 実装は Next.js `middleware` で共通制御し、保存先はメモリキャッシュ（単一インスタンス）または Upstash Redis（本番推奨）を使う。
- 方式はスライディングウィンドウとし、短時間のバーストと継続的な過剰アクセスを同時に抑制する。
- `playerId` 単位のロックは行わない。DoS悪用リスクを考慮した設計上の決定である。
- レートリミット超過時は `429 Too Many Requests` を返し、`Retry-After` を付与する。

## 7. 運用上の制約・注意事項
- 未終了セッション（`status=in_progress`）は自動クローズしない。運用上、手動クローズのみを許可する。
- 営業日切り替えや日跨ぎでも自動補正は行わず、必要に応じて `PATCH /api/sessions/[sessionId]` で運用担当者が修正する。
- ランキング集計対象は `status=closed` のみとし、進行中セッションは常に除外する。
- 金額はすべて整数（pt単位）のみを受け付ける。小数点以下は扱わない。これはアプリの仕様上の確定事項である。

## 8. バリデーション設計
- すべての書き込みAPI（`POST`/`PATCH`/`DELETE`）で、Route Handler入口にてZodスキーマ検証を必須とする。
- 検証は「型」「範囲」「状態遷移（例: `closed -> in_progress` の再開時は `totalCashoutAmount` を `null` に戻す）」を含める。
- `POST /api/sessions/[sessionId]/buyins` は `status=in_progress` のセッションのみ受け付け、`status=closed` の場合は `422` を返す。
- `PATCH/DELETE /api/buyins/[buyinId]` は親セッションが `in_progress` の場合のみ受け付ける。`closed` の場合は先に `PATCH /api/sessions/[sessionId]` で再開する。
- 失敗時は `400 Bad Request`（形式不正）または `422 Unprocessable Entity`（業務ルール違反）を返す。

Zodスキーマ例（テキスト表現）:
```yaml
PostSessionBuyinsRequestSchema:
  type: object
  required: [playerId, pin, amount, idempotencyKey]
  properties:
    playerId: { type: string, format: uuid }
    pin: { type: string, pattern: "^[0-9]{4}$" }
    amount: { type: integer, minimum: 1 }
    idempotencyKey: { type: string, format: uuid }

PatchSessionRequestSchema:
  type: object
  required: [playerId, pin]
  properties:
    playerId: { type: string, format: uuid }
    pin: { type: string, pattern: "^[0-9]{4}$" }
    sessionDate: { type: string, format: date }
    status: { enum: [in_progress, closed] }
    totalCashoutAmount: { type: [integer, "null"], minimum: 0 }
```
