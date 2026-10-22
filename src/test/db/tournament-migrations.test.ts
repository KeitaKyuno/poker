import { readFileSync } from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = process.cwd()

const migrationSql = (n: number) =>
  readFileSync(
    path.join(ROOT, 'supabase', 'migrations', `${String(n).padStart(3, '0')}_${[
      'init',
      'rpc',
      'tournament',
      'tournament_late_entry',
      'tournament_status',
      'tournament_unique_date',
      'tournament_timer_state',
      'tournament_ranking_zerosum',
      'tournament_results_unique_rank',
      'sessions_in_progress_unique',
      'submit_tournament_results_rpc',
      'block_entries_on_finished',
    ][n - 1]}.sql`),
    'utf8',
  )

const checksSql = readFileSync(path.join(ROOT, 'supabase', 'checks', 'tournament_points_check.sql'), 'utf8')

type Row = Record<string, unknown>

let db: PGlite

const query = async <T extends Row = Row>(sql: string): Promise<T[]> => {
  const result = await db.query<T>(sql)
  return result.rows
}

beforeAll(async () => {
  db = new PGlite()

  // PGlite 前処理: Supabase の managed ロール作成を簡略化。
  // 本番 SQL の意味を変えず、権限関連 DDL が通る最小互換として置換する。
  const m1Raw = migrationSql(1)
  const m1Patched = m1Raw
    .replace(/create extension if not exists pgcrypto;?/gi, '-- skipped on pglite: pgcrypto extension is unavailable')
    .replace(/create role authenticated noinherit;?/gi, 'do $$ begin if not exists (select 1 from pg_roles where rolname = \'authenticated\') then create role authenticated; end if; end $$;')
    .replace(/create role anon noinherit;?/gi, 'do $$ begin if not exists (select 1 from pg_roles where rolname = \'anon\') then create role anon; end if; end $$;')
    .replace(/create role service_role noinherit bypassrls;?/gi, 'do $$ begin if not exists (select 1 from pg_roles where rolname = \'service_role\') then create role service_role; end if; end $$;')

  await db.exec(m1Patched)

  for (let migration = 2; migration <= 12; migration += 1) {
    await db.exec(migrationSql(migration))
  }
})

afterAll(async () => {
  await db.close()
})

describe('supabase migrations 008-012 integration on PGlite', () => {
  it('docs rollback SQL(008/009/011/012): 全適用済みDBで実行でき、008後は旧固定配点に戻る', async () => {
    const rollback008 = rollbackSqlFromDoc('008 失敗時')
    const rollback009 = rollbackSqlFromDoc('009 失敗時')
    const rollback011 = rollbackSqlFromDoc('011 失敗時')
    const rollback012 = rollbackSqlFromDoc('012 失敗時')

    const rollbackDb = new PGlite()
    const rollbackQuery = async <T extends Row = Row>(sql: string): Promise<T[]> => {
      const result = await rollbackDb.query<T>(sql)
      return result.rows
    }

    try {
      const m1Raw = migrationSql(1)
      const m1Patched = m1Raw
        .replace(/create extension if not exists pgcrypto;?/gi, '-- skipped on pglite: pgcrypto extension is unavailable')
        .replace(/create role authenticated noinherit;?/gi, 'do $$ begin if not exists (select 1 from pg_roles where rolname = \'authenticated\') then create role authenticated; end if; end $$;')
        .replace(/create role anon noinherit;?/gi, 'do $$ begin if not exists (select 1 from pg_roles where rolname = \'anon\') then create role anon; end if; end $$;')
        .replace(/create role service_role noinherit bypassrls;?/gi, 'do $$ begin if not exists (select 1 from pg_roles where rolname = \'service_role\') then create role service_role; end if; end $$;')

      await rollbackDb.exec(m1Patched)
      for (let migration = 2; migration <= 12; migration += 1) {
        await rollbackDb.exec(migrationSql(migration))
      }

      await rollbackDb.exec(`
        truncate table public.tournament_results, public.tournament_entries, public.tournaments, public.players cascade;

        insert into public.players (id, name, password_hash) values
        ('00000000-0000-0000-0000-000000000041', 'R1', 'dummy_hash_41'),
        ('00000000-0000-0000-0000-000000000042', 'R2', 'dummy_hash_42'),
        ('00000000-0000-0000-0000-000000000043', 'R3', 'dummy_hash_43');

        insert into public.tournaments (id, date, status) values
        ('10000000-0000-0000-0000-000000000041', current_date, 'active'),
        ('10000000-0000-0000-0000-000000000042', current_date + 1, 'active');

        insert into public.tournament_entries (tournament_id, player_id) values
        ('10000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000041'),
        ('10000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000042'),
        ('10000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000043'),
        ('10000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000041'),
        ('10000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000042'),
        ('10000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000043');

        insert into public.tournament_results (tournament_id, player_id, rank) values
        ('10000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000041', 1),
        ('10000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000042', 2),
        ('10000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000043', 3),
        ('10000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000043', 1),
        ('10000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000042', 2),
        ('10000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000041', 3);

        update public.tournaments
        set status = 'finished'
        where id in (
          '10000000-0000-0000-0000-000000000041',
          '10000000-0000-0000-0000-000000000042'
        );
      `)

      await expect(rollbackDb.exec(rollback012)).resolves.not.toThrow()
      await expect(rollbackDb.exec(rollback011)).resolves.not.toThrow()
      await expect(rollbackDb.exec(rollback009)).resolves.not.toThrow()
      await expect(rollbackDb.exec(rollback008)).resolves.not.toThrow()

      const rankingAfter008 = await rollbackQuery<{ player_id: string; total_points: number }>(`
        select player_id, total_points
        from public.v_tournament_ranking
        where player_id in (
          '00000000-0000-0000-0000-000000000041',
          '00000000-0000-0000-0000-000000000042',
          '00000000-0000-0000-0000-000000000043'
        )
        order by player_id;
      `)

      // 旧固定配点ルールで計算:
      // 参加人数は各大会とも tournament_entries 3件 → 1位10, 2位5, 3位3, 4位以下0
      // R1: 大会41で1位(10) + 大会42で3位(3) = 13
      // R2: 大会41で2位(5) + 大会42で2位(5) = 10
      // R3: 大会41で3位(3) + 大会42で1位(10) = 13
      const totals = rankingAfter008.map((row) => ({ player_id: row.player_id, total_points: Number(row.total_points) }))
      expect(totals).toEqual([
        { player_id: '00000000-0000-0000-0000-000000000041', total_points: 13 },
        { player_id: '00000000-0000-0000-0000-000000000042', total_points: 10 },
        { player_id: '00000000-0000-0000-0000-000000000043', total_points: 13 },
      ])
    } finally {
      await rollbackDb.close()
    }
  })

  it('011: 正常系と再提出（finished大会の訂正）', async () => {
    await db.exec(`
      truncate table public.tournament_results, public.tournament_entries, public.tournaments, public.players cascade;

      insert into public.players (id, name, password_hash) values
      ('00000000-0000-0000-0000-000000000001', 'P1', 'dummy_hash_1'),
      ('00000000-0000-0000-0000-000000000002', 'P2', 'dummy_hash_2'),
      ('00000000-0000-0000-0000-000000000003', 'P3', 'dummy_hash_3');

      insert into public.tournaments (id, date, status)
      values ('10000000-0000-0000-0000-000000000001', current_date, 'active');

      insert into public.tournament_entries (tournament_id, player_id) values
      ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
      ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');
    `)

    const first = await query<{ out_player_id: string; out_rank: number }>(`
      select *
      from public.submit_tournament_results(
        '10000000-0000-0000-0000-000000000001',
        '[
          {"playerId":"00000000-0000-0000-0000-000000000001","rank":1},
          {"playerId":"00000000-0000-0000-0000-000000000002","rank":2},
          {"playerId":"00000000-0000-0000-0000-000000000003","rank":3}
        ]'::jsonb
      );
    `)

    expect(first).toEqual([
      { out_player_id: '00000000-0000-0000-0000-000000000001', out_rank: 1 },
      { out_player_id: '00000000-0000-0000-0000-000000000002', out_rank: 2 },
      { out_player_id: '00000000-0000-0000-0000-000000000003', out_rank: 3 },
    ])

    const statusRows = await query<{ status: string }>(`
      select status from public.tournaments where id = '10000000-0000-0000-0000-000000000001';
    `)
    expect(statusRows[0]?.status).toBe('finished')

    const resubmitted = await query<{ out_player_id: string; out_rank: number }>(`
      select *
      from public.submit_tournament_results(
        '10000000-0000-0000-0000-000000000001',
        '[
          {"playerId":"00000000-0000-0000-0000-000000000003","rank":1},
          {"playerId":"00000000-0000-0000-0000-000000000001","rank":2},
          {"playerId":"00000000-0000-0000-0000-000000000002","rank":3}
        ]'::jsonb
      );
    `)

    expect(resubmitted).toEqual([
      { out_player_id: '00000000-0000-0000-0000-000000000003', out_rank: 1 },
      { out_player_id: '00000000-0000-0000-0000-000000000001', out_rank: 2 },
      { out_player_id: '00000000-0000-0000-0000-000000000002', out_rank: 3 },
    ])
  })

  it('011: PT001〜PT008 をそれぞれ返す', async () => {
    await db.exec(`
      truncate table public.tournament_results, public.tournament_entries, public.tournaments, public.players cascade;

      insert into public.players (id, name, password_hash) values
      ('00000000-0000-0000-0000-000000000011', 'Q1', 'dummy_hash_11'),
      ('00000000-0000-0000-0000-000000000012', 'Q2', 'dummy_hash_12'),
      ('00000000-0000-0000-0000-000000000013', 'Q3', 'dummy_hash_13');

      insert into public.tournaments (id, date, status)
      values ('10000000-0000-0000-0000-000000000011', current_date, 'active');

      insert into public.tournament_entries (tournament_id, player_id) values
      ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011'),
      ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012'),
      ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000013');
    `)

    const cases: Array<{ code: string; sql: string }> = [
      {
        code: 'PT001',
        sql: `select * from public.submit_tournament_results('20000000-0000-0000-0000-000000000001', '[]'::jsonb);`,
      },
      {
        code: 'PT002',
        sql: `select * from public.submit_tournament_results('10000000-0000-0000-0000-000000000011', '[{"playerId":"00000000-0000-0000-0000-000000000011","rank":1}]'::jsonb);`,
      },
      {
        code: 'PT003',
        sql: `select * from public.submit_tournament_results('10000000-0000-0000-0000-000000000011', '{"a":1}'::jsonb);`,
      },
      {
        code: 'PT004',
        sql: `select * from public.submit_tournament_results('10000000-0000-0000-0000-000000000011', '[{"playerId":"00000000-0000-0000-0000-000000000011","rank":0},{"playerId":"00000000-0000-0000-0000-000000000012","rank":2},{"playerId":"00000000-0000-0000-0000-000000000013","rank":3}]'::jsonb);`,
      },
      {
        code: 'PT005',
        sql: `select * from public.submit_tournament_results('10000000-0000-0000-0000-000000000011', '[{"playerId":"00000000-0000-0000-0000-000000000011","rank":1},{"playerId":"00000000-0000-0000-0000-000000000011","rank":2},{"playerId":"00000000-0000-0000-0000-000000000013","rank":3}]'::jsonb);`,
      },
      {
        code: 'PT006',
        sql: `select * from public.submit_tournament_results('10000000-0000-0000-0000-000000000011', '[{"playerId":"00000000-0000-0000-0000-000000000011","rank":1},{"playerId":"00000000-0000-0000-0000-000000000012","rank":1},{"playerId":"00000000-0000-0000-0000-000000000013","rank":3}]'::jsonb);`,
      },
      {
        code: 'PT007',
        sql: `select * from public.submit_tournament_results('10000000-0000-0000-0000-000000000011', '[{"playerId":"00000000-0000-0000-0000-000000000011","rank":1},{"playerId":"00000000-0000-0000-0000-000000000012","rank":2},{"playerId":"00000000-0000-0000-0000-000000000099","rank":3}]'::jsonb);`,
      },
      {
        code: 'PT008',
        sql: `select * from public.submit_tournament_results('10000000-0000-0000-0000-000000000011', '[{"playerId":"00000000-0000-0000-0000-000000000011","rank":1},{"playerId":"00000000-0000-0000-0000-000000000012","rank":3},{"playerId":"00000000-0000-0000-0000-000000000013","rank":4}]'::jsonb);`,
      },
    ]

    for (const t of cases) {
      await expect(db.exec(t.sql)).rejects.toMatchObject({ code: t.code })
    }
  })

  it('012: finished大会のentriesロックとCASCADE削除', async () => {
    await db.exec(`
      truncate table public.tournament_results, public.tournament_entries, public.tournaments, public.players cascade;

      insert into public.players (id, name, password_hash) values
      ('00000000-0000-0000-0000-000000000021', 'R1', 'dummy_hash_21'),
      ('00000000-0000-0000-0000-000000000022', 'R2', 'dummy_hash_22'),
      ('00000000-0000-0000-0000-000000000023', 'R3', 'dummy_hash_23');

      insert into public.tournaments (id, date, status) values
      ('10000000-0000-0000-0000-000000000021', current_date, 'active'),
      ('10000000-0000-0000-0000-000000000022', current_date + 1, 'active');

      insert into public.tournament_entries (tournament_id, player_id) values
      ('10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000021'),
      ('10000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000022');

      update public.tournaments
      set status = 'finished'
      where id = '10000000-0000-0000-0000-000000000022';
    `)

    await expect(
      db.exec(`
        insert into public.tournament_entries (tournament_id, player_id)
        values ('10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000023');
      `),
    ).resolves.not.toThrow()

    await expect(
      db.exec(`
        insert into public.tournament_entries (tournament_id, player_id)
        values ('10000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000023');
      `),
    ).rejects.toMatchObject({ code: 'PT009' })

    await expect(
      db.exec(`
        update public.tournament_entries
        set player_id = '00000000-0000-0000-0000-000000000023'
        where tournament_id = '10000000-0000-0000-0000-000000000022'
          and player_id = '00000000-0000-0000-0000-000000000022';
      `),
    ).rejects.toMatchObject({ code: 'PT009' })

    await expect(
      db.exec(`
        update public.tournament_entries
        set tournament_id = '10000000-0000-0000-0000-000000000021'
        where tournament_id = '10000000-0000-0000-0000-000000000022'
          and player_id = '00000000-0000-0000-0000-000000000022';
      `),
    ).rejects.toMatchObject({ code: 'PT009' })

    await expect(
      db.exec(`
        update public.tournament_entries
        set tournament_id = '10000000-0000-0000-0000-000000000022'
        where tournament_id = '10000000-0000-0000-0000-000000000021'
          and player_id = '00000000-0000-0000-0000-000000000021';
      `),
    ).rejects.toMatchObject({ code: 'PT009' })

    await expect(
      db.exec(`
        update public.tournament_entries
        set starting_level = 2
        where tournament_id = '10000000-0000-0000-0000-000000000021'
          and player_id = '00000000-0000-0000-0000-000000000021';
      `),
    ).resolves.not.toThrow()

    await expect(
      db.exec(`
        delete from public.tournament_entries
        where tournament_id = '10000000-0000-0000-0000-000000000022'
          and player_id = '00000000-0000-0000-0000-000000000022';
      `),
    ).rejects.toMatchObject({ code: 'PT009' })

    await expect(
      db.exec(`delete from public.tournaments where id = '10000000-0000-0000-0000-000000000022';`),
    ).resolves.not.toThrow()

    const remain = await query<{ count: string }>(`
      select count(*)::text as count
      from public.tournament_entries
      where tournament_id = '10000000-0000-0000-0000-000000000022';
    `)
    expect(remain[0]?.count).toBe('0')

    await db.exec(`
      insert into public.tournaments (id, date, status) values
      ('10000000-0000-0000-0000-000000000024', current_date + 2, 'active');

      insert into public.tournament_entries (tournament_id, player_id) values
      ('10000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000021');

      update public.tournaments
      set status = 'finished'
      where id = '10000000-0000-0000-0000-000000000024';
    `)

    await expect(
      db.exec(`
        begin;
        delete from public.tournaments where id = '10000000-0000-0000-0000-000000000024';
        commit;
      `),
    ).resolves.not.toThrow()

    const remain2 = await query<{ count: string }>(`
      select count(*)::text as count
      from public.tournament_entries
      where tournament_id = '10000000-0000-0000-0000-000000000024';
    `)
    expect(remain2[0]?.count).toBe('0')

    await db.exec(`
      insert into public.tournaments (id, date, status) values
      ('10000000-0000-0000-0000-000000000025', current_date + 3, 'active'),
      ('10000000-0000-0000-0000-000000000026', current_date + 4, 'active'),
      ('10000000-0000-0000-0000-000000000027', current_date + 5, 'active');

      insert into public.tournament_entries (tournament_id, player_id) values
      ('10000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000021'),
      ('10000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000022'),
      ('10000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000022'),
      ('10000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000023'),
      ('10000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000021');

      update public.tournaments
      set status = 'finished'
      where id in (
        '10000000-0000-0000-0000-000000000025',
        '10000000-0000-0000-0000-000000000026'
      );
    `)

    await expect(
      db.exec(`
        delete from public.tournaments
        where id in (
          '10000000-0000-0000-0000-000000000025',
          '10000000-0000-0000-0000-000000000026'
        );
      `),
    ).resolves.not.toThrow()

    const removed25 = await query<{ count: string }>(`
      select count(*)::text as count
      from public.tournament_entries
      where tournament_id = '10000000-0000-0000-0000-000000000025';
    `)
    expect(removed25[0]?.count).toBe('0')

    const removed26 = await query<{ count: string }>(`
      select count(*)::text as count
      from public.tournament_entries
      where tournament_id = '10000000-0000-0000-0000-000000000026';
    `)
    expect(removed26[0]?.count).toBe('0')

    const remainActive = await query<{ count: string }>(`
      select count(*)::text as count
      from public.tournament_entries
      where tournament_id = '10000000-0000-0000-0000-000000000027';
    `)
    expect(remainActive[0]?.count).toBe('1')
  })

  it('008/009/check: ゼロサム集計・同点rank・一意制約・整合性検査', async () => {
    await db.exec(`
      truncate table public.tournament_results, public.tournament_entries, public.tournaments, public.players cascade;

      insert into public.players (id, name, password_hash) values
      ('00000000-0000-0000-0000-000000000031', 'A', 'dummy_hash_31'),
      ('00000000-0000-0000-0000-000000000032', 'B', 'dummy_hash_32'),
      ('00000000-0000-0000-0000-000000000033', 'C', 'dummy_hash_33'),
      ('00000000-0000-0000-0000-000000000034', 'D', 'dummy_hash_34'),
      ('00000000-0000-0000-0000-000000000035', 'E', 'dummy_hash_35'),
      ('00000000-0000-0000-0000-000000000036', 'F', 'dummy_hash_36');

      insert into public.tournaments (id, date, status) values
      ('10000000-0000-0000-0000-000000000031', current_date, 'active'),
      ('10000000-0000-0000-0000-000000000032', current_date + 1, 'active'),
      ('10000000-0000-0000-0000-000000000033', current_date + 2, 'active');

      insert into public.tournament_entries (tournament_id, player_id)
      select '10000000-0000-0000-0000-000000000031', id from public.players where id <> '00000000-0000-0000-0000-000000000036';

      insert into public.tournament_entries (tournament_id, player_id)
      select '10000000-0000-0000-0000-000000000032', id from public.players;

      insert into public.tournament_entries (tournament_id, player_id)
      select '10000000-0000-0000-0000-000000000033', id from public.players;

      insert into public.tournament_results (tournament_id, player_id, rank) values
      ('10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000031', 1),
      ('10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000032', 2),
      ('10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000033', 3),
      ('10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000034', 4),
      ('10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000035', 5),
      ('10000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000036', 1),
      ('10000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000035', 2),
      ('10000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000034', 3),
      ('10000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000033', 4),
      ('10000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000032', 5),
      ('10000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000031', 6);

      update public.tournaments
      set status = 'finished'
      where id in (
        '10000000-0000-0000-0000-000000000031',
        '10000000-0000-0000-0000-000000000032'
      );
    `)

    const points5 = await query<{ rank: number; points: number }>(`
      select rank, points
      from public.v_tournament_entry_points
      where tournament_id = '10000000-0000-0000-0000-000000000031'
      order by rank;
    `)
    expect(points5.map((r) => r.points)).toEqual([4, 2, 0, -2, -4])

    const points6 = await query<{ rank: number; points: number }>(`
      select rank, points
      from public.v_tournament_entry_points
      where tournament_id = '10000000-0000-0000-0000-000000000032'
      order by rank;
    `)
    expect(points6.map((r) => r.points)).toEqual([5, 3, 1, -1, -3, -5])

    const sumRows = await query<{ tournament_id: string; total: number }>(`
      select tournament_id, sum(points)::integer as total
      from public.v_tournament_entry_points
      group by tournament_id
      order by tournament_id;
    `)
    expect(sumRows.map((r) => r.total)).toEqual([0, 0])

    const activeRows = await query<{ count: string }>(`
      select count(*)::text as count
      from public.v_tournament_entry_points
      where tournament_id = '10000000-0000-0000-0000-000000000033';
    `)
    expect(activeRows[0]?.count).toBe('0')

    const ranking = await query<{ rank: number; player_name: string; total_points: number; game_count: number }>(`
      select rank, player_name, total_points, game_count
      from public.v_tournament_ranking
      order by rank, player_name;
    `)

    const a = ranking.find((r) => r.player_name === 'A')
    const b = ranking.find((r) => r.player_name === 'B')
    const c = ranking.find((r) => r.player_name === 'C')
    expect(a?.total_points).toBe(-1)
    expect(a?.game_count).toBe(2)
    expect(b?.total_points).toBe(-1)
    expect(b?.game_count).toBe(2)
    expect(c?.total_points).toBe(-1)
    expect(c?.game_count).toBe(2)
    expect(a?.rank).toBe(b?.rank)
    expect(b?.rank).toBe(c?.rank)

    await expect(
      db.exec(`
        insert into public.tournament_results (tournament_id, player_id, rank)
        values ('10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000036', 1);
      `),
    ).rejects.toMatchObject({ code: '23505' })

    const checkOk = await query(checksSql)
    expect(checkOk).toHaveLength(0)

    await db.exec(`
      delete from public.tournament_results
      where tournament_id = '10000000-0000-0000-0000-000000000031'
        and player_id = '00000000-0000-0000-0000-000000000035';
    `)

    const checkNg = await query<{ issue: string }>(checksSql)
    expect(checkNg.length).toBeGreaterThan(0)
  })
})

const deployDoc = readFileSync(path.join(ROOT, 'docs', 'deploy-tournament-zerosum.md'), 'utf8')

const rollbackSqlFromDoc = (sectionTitle: string) => {
  const title = `### ${sectionTitle}`
  const start = deployDoc.indexOf(title)
  if (start < 0) throw new Error(`Section not found: ${sectionTitle}`)

  const blockStart = deployDoc.indexOf('```sql', start)
  if (blockStart < 0) throw new Error(`SQL block not found: ${sectionTitle}`)

  const sqlStart = blockStart + '```sql'.length
  const blockEnd = deployDoc.indexOf('```', sqlStart)
  if (blockEnd < 0) throw new Error(`SQL block terminator not found: ${sectionTitle}`)

  return deployDoc.slice(sqlStart, blockEnd).trim()
}
