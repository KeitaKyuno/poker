import Link from 'next/link'

function LinkButton({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href}>
      <div className="flex h-full cursor-pointer flex-col gap-1 rounded-xl border-2 border-white/80 px-5 py-4 text-white transition-all duration-200 hover:bg-white/10 hover:shadow-[0_0_16px_rgba(255,255,255,0.2)]">
        <span className="text-base font-bold">{title}</span>
      </div>
    </Link>
  )
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-wide text-primary drop-shadow-[0_0_14px_rgba(212,175,55,0.24)]">Plottポーカーリーグ</h1>

      <section className="space-y-3">
        <h2 className="text-sm text-white/80">キャッシュゲーム</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <LinkButton href="/sessions/start" title="参加登録" />
          <LinkButton href="/ranking/monthly" title="ランキング" />
          <LinkButton href="/stats" title="戦績" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm text-white/80">トーナメント</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <LinkButton href="/tournament/setup" title="参加登録" />
          <LinkButton href="/tournament/ranking" title="ランキング" />
          <LinkButton href="/tournament/stats" title="戦績" />
          <LinkButton href="/tournament/results" title="順位登録" />
          <LinkButton href="/tournament/timer" title="タイマー" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm text-white/80">その他</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <LinkButton href="/players/new" title="プレイヤー登録" />
          <LinkButton href="/edit" title="修正" />
        </div>
      </section>
    </main>
  )
}
