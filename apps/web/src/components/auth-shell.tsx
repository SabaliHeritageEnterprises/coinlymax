import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

/** Centered card layout shared by all auth screens. */
export function AuthShell({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid place-items-center px-4 bg-hero-glow">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 font-bold text-xl mb-8">
          <span className="grid place-items-center h-9 w-9 rounded-lg bg-gold-gradient text-black">
            <TrendingUp size={20} />
          </span>
          Crypto<span className="text-gold">Coin</span>
        </Link>
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-1">{title}</h1>
          {subtitle && <p className="text-muted text-sm mb-6">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
