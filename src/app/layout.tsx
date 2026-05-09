import type { Metadata } from 'next'
import { Noto_Sans_JP } from 'next/font/google'

import { Toaster } from '@/components/ui/sonner'

import './globals.css'

const notoSansJp = Noto_Sans_JP({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Plottポーカーリーグ',
  description: 'キャッシュゲームの参加記録とランキングを管理します',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={notoSansJp.variable}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
