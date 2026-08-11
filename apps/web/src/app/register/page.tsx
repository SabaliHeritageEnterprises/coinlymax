'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/store/auth';
import { TrendingUp, Gift, Users, ShieldCheck, BarChart3, X } from 'lucide-react';

function authError(e: any): string {
  const code = e?.code ?? '';
  if (code.includes('email-already-in-use')) return 'That email is already registered. Try logging in.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
  return e?.message ?? 'Could not create your account.';
}

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuth((s) => s.register);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!agree) { setError('Please agree to the Terms & Privacy Notice.'); return; }
    if (!email || !password) { setError('Enter your email and a password.'); return; }
    setBusy(true);
    try {
      await register(email, password, email.split('@')[0]);
      // Firebase signs the user in on registration → straight to the dashboard.
      router.push('/dashboard');
    } catch (e) {
      setError(authError(e));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg">
      {/* ─────────────  LEFT: promo panel  ───────────── */}
      <aside className="relative hidden lg:flex flex-col justify-center px-16 overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <Link href="/" className="absolute top-8 left-16 flex items-center gap-2 font-bold text-lg">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-gold-gradient text-black"><TrendingUp size={18} /></span>
          Crypto<span className="text-gold">Coin</span>
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative">
          <h1 className="text-5xl font-bold leading-tight">
            Trade <span className="text-gold">Crypto &amp; Forex</span><br />Like a Pro
          </h1>
          <p className="text-muted mt-3">Create your account, fund your wallet, and start trading.</p>

          {/* Gift illustration */}
          <div className="my-10 grid place-items-center">
            <div className="relative grid place-items-center h-44 w-44 rounded-full"
                 style={{ background: 'radial-gradient(circle, rgba(240,185,11,.18), transparent 70%)' }}>
              <Gift size={96} className="text-gold drop-shadow-[0_0_24px_rgba(240,185,11,.5)]" strokeWidth={1.4} />
            </div>
          </div>

          <ul className="space-y-4 max-w-md">
            <Bullet icon={Users} title="319,000+ simulated traders" sub="Join a growing community of learners." />
            <Bullet icon={BarChart3} title="Pro charts & trading terminal" sub="TradingView indicators, live order book feel." />
            <Bullet icon={ShieldCheck} title="100% risk-free paper trading" sub="No deposits, withdrawals, or real funds — ever." />
          </ul>
        </motion.div>
      </aside>

      {/* ─────────────  RIGHT: form panel  ───────────── */}
      <main className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 relative">
        {/* mobile logo */}
        <Link href="/" className="lg:hidden flex items-center gap-2 font-bold text-lg mb-10">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-gold-gradient text-black"><TrendingUp size={18} /></span>
          Crypto<span className="text-gold">Coin</span>
        </Link>

        <div className="w-full max-w-sm mx-auto">
          {done ? (
            <Done email={email} />
          ) : (
            <>
              <h2 className="text-3xl font-bold mb-7">Join CryptoCoin today</h2>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-sm text-muted">Email</label>
                  <div className="relative mt-1.5">
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com" required
                      className="input pr-9 h-12"
                    />
                    {email && (
                      <button type="button" aria-label="Clear email" onClick={() => setEmail('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted">Password</label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPwd ? 'text' : 'password'} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password" required
                      className="input pr-14 h-12"
                    />
                    <button type="button" onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-white">
                      {showPwd ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1.5">8+ chars with upper, lower, a number & a symbol.</p>
                </div>

                <label className="flex items-start gap-2 text-sm text-muted cursor-pointer pt-1">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 accent-[var(--gold)]" style={{ width: 16, height: 16 }} />
                  <span>By creating an account, I agree to cryptocoin&apos;s{' '}
                    <a href="#" className="text-gold underline">Terms</a> &{' '}
                    <a href="#" className="text-gold underline">Privacy Notice</a>.</span>
                </label>

                {error && <p className="text-down text-sm">{error}</p>}

                <button type="submit" disabled={busy}
                  className="w-full h-12 rounded-lg font-semibold text-black transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#fcd535,#f0b90b)' }}>
                  {busy ? 'Creating account…' : 'Continue'}
                </button>
              </form>

              {/* divider */}
              <div className="flex items-center gap-4 my-6">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              {/* social (not yet wired — honest placeholder) */}
              <div className="space-y-3">
                <Social label="Continue with Google" onClick={() => setInfo('Social sign-in is coming soon — use email for now.')} icon={<GoogleIcon />} />
                <Social label="Continue with Apple" onClick={() => setInfo('Social sign-in is coming soon — use email for now.')} icon={<AppleIcon />} />
                <Social label="Continue with Telegram" onClick={() => setInfo('Social sign-in is coming soon — use email for now.')} icon={<TelegramIcon />} />
              </div>

              {info && <p className="text-xs text-muted text-center mt-4">{info}</p>}

              <p className="text-sm text-center mt-7 text-muted">
                Already have an account? <Link href="/login" className="text-gold">Log in</Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-10">
          Trading platform · real funds, deposits, or withdrawals.
        </p>
      </main>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function Bullet({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid place-items-center h-9 w-9 rounded-lg bg-bg-card border border-border text-gold shrink-0">
        <Icon size={18} />
      </span>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
    </li>
  );
}

function Social({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full h-12 rounded-lg border border-border bg-bg-card hover:bg-bg-hover transition flex items-center justify-center gap-3 font-medium text-sm">
      {icon}{label}
    </button>
  );
}

function Done({ email }: { email: string }) {
  return (
    <div className="text-center">
      <div className="grid place-items-center h-16 w-16 mx-auto rounded-full bg-bg-card border border-gold/40 text-gold mb-5">
        <Gift size={28} />
      </div>
      <h2 className="text-2xl font-bold mb-2">Check your email</h2>
      <p className="text-muted text-sm">
        We sent a verification link to <b className="text-white">{email}</b> to activate your account.
        Once verified, you can fund your wallet from the <span className="text-gold">Deposit</span> tab and start trading.
      </p>
      <p className="text-muted text-xs mt-4">
        Running locally without SMTP? The link is printed to the API server console.
      </p>
      <Link href="/login" className="btn-gold inline-block mt-6">Go to log in</Link>
    </div>
  );
}

/* ---------- brand icons (inline SVG) ---------- */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.1 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.3-.1-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.1 29.1 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.6-11.3-8.4l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C40.9 35.6 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.7 2.3 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.4-3.5zM14.2 6c.6-.7 1-1.7.9-2.7-.9.1-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z"/>
    </svg>
  );
}
function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#229ED9" aria-hidden>
      <path d="M22 3.5L2.5 11c-1.3.5-1.3 1.3-.2 1.6l5 1.6 1.9 6c.2.6.4.9.9.9.4 0 .6-.2.9-.5l2.4-2.3 5 3.7c.9.5 1.6.2 1.8-.9L23.9 4.8c.3-1.3-.5-1.9-1.9-1.3z" transform="scale(.95) translate(.5 .5)"/>
    </svg>
  );
}
