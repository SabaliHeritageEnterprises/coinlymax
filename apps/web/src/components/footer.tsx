import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

const COLS = [
  { title: 'Products', links: ['Markets', 'Trading Terminal', 'Watchlists', 'API (soon)'] },
  { title: 'Company', links: ['About', 'Careers', 'Press', 'Blog'] },
  { title: 'Support', links: ['Help Center', 'Contact', 'System Status', 'Fees'] },
  { title: 'Legal', links: ['Terms', 'Privacy', 'Risk Disclosure', 'Compliance'] },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-bg-soft mt-24">
      <div className="mx-auto max-w-7xl px-4 py-12 grid grid-cols-2 md:grid-cols-6 gap-8">
        <div className="col-span-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-gold-gradient text-black">
              <TrendingUp size={18} />
            </span>
            Crypto<span className="text-gold">Coin</span>
          </Link>
          <p className="text-sm text-muted mt-4 max-w-xs">
            A next-generation crypto &amp; forex trading platform with real-time charts and a
            professional terminal.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="font-semibold mb-3 text-sm">{c.title}</h4>
            <ul className="space-y-2 text-sm text-muted">
              {c.links.map((l) => (
                <li key={l}><a href="#" className="hover:text-white transition">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} CryptoCoin. All rights reserved.
      </div>
    </footer>
  );
}
