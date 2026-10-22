# トーナメントゼロサム対称ポイント制 デプロイ手順

## 前提
- 対象: Supabase + Vercel 本番環境
- SQLは Supabase SQL Editor で**手動実行**する
- アプリは GitHub `main` への push で Vercel 自動デプロイ

## なぜ SQL 適用前 push がNGか
- 先にアプリだけ新コードへ更新すると、`submit_tournament_results` RPC や制約・トリガーがDB側に未適用のため、順位登録時の整合性前提が崩れる。
- 逆に、先にDB（`008 → 011 → 012`）を適用しておけば、旧アプリも新アプリもDB整合性ルールに沿って動作する。
- `009` は旧アプリの順位入れ替え実装と衝突するため、**アプリデプロイ後**に適用する。

## 手順
1. **事前チェック**
   - `supabase/checks/tournament_points_check.sql` を実行して結果0件を確認

2. **マイグレーション適用（この順番固定）**
   - `supabase/migrations/008_tournament_ranking_zerosum.sql`
   - `supabase/migrations/011_submit_tournament_results_rpc.sql`
   - `supabase/migrations/012_block_entries_on_finished.sql`

3. **事後チェック**
   - 再度 `supabase/checks/tournament_points_check.sql` を実行して0件を確認

4. **アプリデプロイ**
   - GitHub `main` に push
   - Vercel 自動デプロイ完了を確認

## 一時的な表示差異と運用注意（008適用後〜デプロイ完了まで）
- `008` 適用から Vercel デプロイ完了までの数分間は、旧アプリ画面で表示差異が発生する。
- 旧アプリのランキング画面は、DBビュー経由で新ポイント（ゼロサム）表示になる。
- 旧アプリの戦績グラフは、アプリ側ロジックで旧配点計算のまま表示される。
- この差異は一時的な表示不一致であり、エラーではない。
- この時間帯はトーナメントの順位登録・参加登録を行わないよう、参加者へ事前周知する。

5. **009 の重複確認**
   - `supabase/migrations/009_tournament_results_unique_rank.sql` 冒頭コメントの重複確認SQLを実行して0件を確認

6. **009 適用**
   - `supabase/migrations/009_tournament_results_unique_rank.sql`

### 009 を最後に適用する理由
- 009 の `UNIQUE (tournament_id, rank)` は即時評価のため、旧アプリの順位登録（`tournament_results` への upsert で順位を入れ替える実装）が一時的な重複順位を作ると一意制約違反になる。
- 新アプリは `submit_tournament_results` RPC 内で `DELETE` → `INSERT` で置換するため、009 適用後も順位登録で一意制約違反を起こさない。

## 旧アプリと新DBの互換性
- 011 は新規 RPC（`submit_tournament_results` の中身更新）であり、旧アプリの通常導線では直接利用しない。
- 008〜012（009 除く）を適用した状態でも、旧アプリの順位登録・参加登録は動作する。
- 012 により `finished` 大会への参加者追加は旧アプリでもエラーになるが、正規運用では本来発生しない操作のため許容できる。

## 失敗時の戻し方（ロールバックSQL）

### 008 失敗時
- 以下をそのまま実行して、008 適用前のビュー定義へ戻す（トランザクション実行）:
```sql
begin;

drop view if exists public.v_tournament_ranking;
drop view if exists public.v_tournament_entry_points;

create view public.v_tournament_ranking as
with entry_counts as (
  select
    tournament_id,
    count(*)::integer as entry_count
  from public.tournament_entries
  group by tournament_id
), scored as (
  select
    tr.player_id,
    p.name as player_name,
    tr.tournament_id,
    tr.rank,
    ec.entry_count,
    case
      when tr.rank = 1 then 10
      when tr.rank = 2 then 5
      when tr.rank = 3 and ec.entry_count >= 3 then 3
      when tr.rank = 4 and ec.entry_count >= 6 then 2
      when tr.rank = 5 and ec.entry_count >= 8 then 1
      else 0
    end::integer as points
  from public.tournament_results tr
  join public.players p on p.id = tr.player_id
  join entry_counts ec on ec.tournament_id = tr.tournament_id
)
select
  rank() over(order by sum(points) desc, player_name asc)::integer as rank,
  player_id,
  player_name,
  sum(points)::integer as total_points,
  count(*)::integer as game_count
from scored
group by player_id, player_name
order by total_points desc, player_name asc;

commit;
```

### 009 失敗時
- 制約作成前に戻す:
```sql
alter table public.tournament_results
  drop constraint if exists tournament_results_tournament_id_rank_key;
```

### 011 失敗時
- 関数削除で 011 の変更を無効化:
```sql
drop function if exists public.submit_tournament_results(uuid, jsonb);
drop function if exists public.parse_tournament_results(jsonb);
```
- **注意**: 011 をロールバックすると新アプリの順位登録は動かなくなるため、アプリも 011 適用前のデプロイへ戻すこと。

### 012 失敗時
- トリガー/関数削除で無効化（2トリガー・2関数）:
```sql
drop trigger if exists trg_block_tournament_entries_on_finished on public.tournament_entries;
drop trigger if exists trg_mark_deleting_tournament_id on public.tournaments;
drop function if exists public.block_tournament_entries_on_finished();
drop function if exists public.mark_deleting_tournament_id();
```

## 運用メモ
- 012トリガーは `tournament_entries` の INSERT/UPDATE/DELETE のみ対象。
- `submit_tournament_results` は `tournament_entries` を更新しないため影響なし。
- `tournaments` 削除時の `ON DELETE CASCADE` による `tournament_entries` 削除は、親行参照が消えているためトリガー条件にヒットせずブロックされない。
