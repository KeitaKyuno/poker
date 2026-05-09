import Link from 'next/link'

type BackButtonProps = {
  href: string
}

export function BackButton({ href }: BackButtonProps) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex w-fit items-center border border-white/50 rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
    >
      ← 戻る
    </Link>
  )
}
