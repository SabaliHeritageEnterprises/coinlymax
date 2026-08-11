import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Change this line from 'ApexTrade' to 'CoinlyMax'
const SITE = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CoinlyMax';

export const metadata: Metadata = {
  title: {
    default: `${SITE} — Crypto & Forex Trading Platform`,
    template: `%s · ${SITE}`,
  },
  description:
    'Trade crypto and forex with real-time charts, a professional terminal, and a risk-free simulation engine. Built for the next generation of traders.',
  keywords: ['crypto', 'forex', 'trading', 'exchange', 'bitcoin', 'charts', 'simulation'],
  openGraph: { title: SITE, type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-bg text-white font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}