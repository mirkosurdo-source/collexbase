import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Navbar from '@/components/Navbar'
import ReferralClaimer from '@/components/ReferralClaimer'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import './globals.css'

// Blocco 26 — applies the persisted theme + language before first paint to avoid a flash.
const noFlashScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('collexbase:theme');if(t==='dark'){d.classList.add('dark');}else if(t==='light'){d.classList.add('light');}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){d.classList.add('dark');}var l=localStorage.getItem('collexbase:lang');if(l){d.setAttribute('lang',l);}}catch(e){}})();`

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'CollexBase',
  description: 'CollexBase — la piattaforma per collezionisti',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="font-sans antialiased">
        <LanguageProvider>
          <ReferralClaimer />
          <Navbar />
          <main className="mx-auto w-full max-w-6xl px-4">{children}</main>
        </LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
