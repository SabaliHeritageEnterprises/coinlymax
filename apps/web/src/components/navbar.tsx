'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { TrendingUp, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/markets', label: 'Markets' },
  { href: '/trade/BTCUSDT', label: 'Trade' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-gold-gradient text-black">
            <TrendingUp size={18} />
          </span>
          <span>Crypto<span className="text-gold">Coin</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-white transition">
              {n.label}
            </Link>
          ))}
          {user && (user.role === 'admin' || user.role === 'super_admin') && (
            <Link href="/admin" className="hover:text-gold transition">Admin</Link>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted">{user.displayName ?? user.email}</span>
              <button
                onClick={async () => {
                  await logout();
                  router.push('/');
                }}
                className="btn-ghost text-sm"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost text-sm">Log in</Link>
              <Link href="/register" className="btn-gold text-sm">Sign up</Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 px-4 py-3 flex flex-col gap-3 bg-bg-soft">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-1">
              {n.label}
            </Link>
          ))}
          {user ? (
            <button onClick={() => logout()} className="btn-ghost">Log out</button>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" className="btn-ghost flex-1 text-center">Log in</Link>
              <Link href="/register" className="btn-gold flex-1 text-center">Sign up</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
