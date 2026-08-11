'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { PriceTicker } from '@/components/price-ticker';
import { TopMovers } from '@/components/top-movers';
import { MarketTable } from '@/components/market-table';
import { api } from '@/lib/api';
import type { MarketPair } from '@/lib/types';
import {
  ShieldCheck, Zap, LineChart, Globe, BarChart3, Wallet, ChevronDown,
} from 'lucide-react';

const CATEGORIES = [
  { icon: LineChart, title: 'Spot Crypto', desc: 'BTC, ETH, SOL and 100+ pairs with deep liquidity.' },
  { icon: Globe, title: 'Forex & Metals', desc: 'Majors, minors, gold & silver in real time.' },
  { icon: BarChart3, title: 'Advanced Charts', desc: 'TradingView indicators, drawing tools, multi-timeframe.' },
  { icon: Wallet, title: 'Unified Wallet', desc: 'Fund once and trade across every crypto and forex pair.' },
];

const FEATURES = [
  { icon: Zap, title: 'Real-time data', desc: 'Sub-second WebSocket price streaming across every market.' },
  { icon: ShieldCheck, title: 'Bank-grade security', desc: '2FA, device management, encrypted sessions, RBAC.' },
  { icon: LineChart, title: 'Pro terminal', desc: 'Order panel, positions, history — a true trading cockpit.' },
];

// Deliberately unconventional FAQ — not the usual fees/KYC/withdrawal list.
const FAQ = [
  { q: 'How fast do my charts and positions react when the market moves?', a: 'Everything streams over live WebSockets — tickers, candlesticks, and your open positions refresh in real time, usually within a second of a price change.' },
  { q: 'Can I make the workspace truly mine?', a: 'Yes. Build multiple custom watchlists, star favorite pairs, and your layout, theme, and preferences are saved to your account and follow you across devices.' },
  { q: 'What happens when I log in from a new phone or laptop?', a: 'Each device gets its own secure session. You can see every active device and sign any of them out instantly from Security → Devices, and lock things down further with two-factor authentication.' },
  { q: 'Will the account I build today still be here as the platform grows?', a: 'Your profile, trade history, watchlists, and balance carry forward as new features ship — nothing you set up gets reset behind the scenes.' },
];

export default function LandingPage() {
  const [pairs, setPairs] = useState<MarketPair[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    api.get<MarketPair[]>('/market/pairs').then((r) => setPairs(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <PriceTicker />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <span className="inline-block text-xs font-medium px-3 py-1 rounded-full border border-gold/40 text-gold mb-6">
              Crypto & Forex · Real-time charts
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Trade crypto & forex like a <span className="text-gold">professional</span>.
            </h1>
            <p className="text-muted text-lg mt-6 max-w-xl">
              Real-time charts, a powerful trading terminal, and a risk-free engine to
              sharpen your edge. The foundation for the next-generation exchange.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/register" className="btn-gold">Start trading free</Link>
              <Link href="/markets" className="btn-ghost">Explore markets</Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-14"
          >
            <TopMovers />
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold mb-8">Trade across markets</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card p-6 hover:border-gold/40 transition group"
            >
              <c.icon className="text-gold mb-4 group-hover:scale-110 transition" />
              <h3 className="font-semibold mb-1">{c.title}</h3>
              <p className="text-sm text-muted">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Live markets preview */}
      <section className="mx-auto max-w-7xl px-4 py-12 w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Live markets</h2>
          <Link href="/markets" className="text-gold text-sm hover:underline">View all →</Link>
        </div>
        <MarketTable pairs={pairs.slice(0, 8)} />
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <f.icon className="text-gold mb-4" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="card p-10 md:p-16 text-center bg-hero-glow relative overflow-hidden">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to build your edge?</h2>
          <p className="text-muted mt-3">Create your free account, fund it, and start trading in minutes.</p>
          <Link href="/register" className="btn-gold inline-block mt-6">Create free account</Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-12 w-full">
        <h2 className="text-2xl font-bold mb-6 text-center">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left font-medium"
              >
                {f.q}
                <ChevronDown className={openFaq === i ? 'rotate-180 transition' : 'transition'} size={18} />
              </button>
              {openFaq === i && <p className="px-4 pb-4 text-sm text-muted">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
