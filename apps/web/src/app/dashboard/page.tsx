'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { useAuth } from '@/store/auth';
import { listenUserActivity, updateDisplayName, fbResetPassword } from '@/lib/fb';
import { db } from '@/components/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  Wallet, ArrowDownToLine, Activity, Settings, Eye, EyeOff, Copy, Check, ShieldCheck, Shield,
} from 'lucide-react';
import KYCForm from '@/components/KYCForm';

type Tab = 'portfolio' | 'deposit' | 'activity' | 'settings' | 'kyc';

function fmtUsd(n: number) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Portfolio Tab Component
function PortfolioTab({ balance }: { balance: number }) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <Metric label="Total Equity" value={fmtUsd(balance)} highlight />
        <Metric label="Cash Balance" value={fmtUsd(balance)} />
        <Metric label="Unrealized PnL" value={fmtUsd(0)} />
      </div>
      <div className="card p-5">
        {balance > 0 ? (
          <p className="text-sm text-muted">Your account is funded. Head to the markets to start trading.</p>
        ) : (
          <p className="text-sm text-muted">
            Your balance is <b className="text-white">$0</b>. Use the <span className="text-gold">Deposit</span> tab to fund
            your account — once a deposit is confirmed by an administrator, your balance updates here automatically.
          </p>
        )}
      </div>
    </div>
  );
}

// Deposit Tab Component with Card Form
const DEPOSIT_ASSETS = [
  { sym: 'USDT', name: 'Tether', network: 'TRC20 (Tron)', glyph: '₮', color: '#26a17b', address: '0xae2ac7d436e9c6aa0a9d7468f12d7e90efc6d59d' },
  { sym: 'BTC', name: 'Bitcoin', network: 'Bitcoin (native SegWit)', glyph: '₿', color: '#f7931a', address: 'bc1qgxkt5vfh5z2nccqscq00fcjeun26cckjgfuzendhvj483sgcupvskqk0ak' },
  { sym: 'ETH', name: 'Ethereum', network: 'ERC20 (Ethereum)', glyph: 'Ξ', color: '#627eea', address: '0xae2ac7d436e9c6aa0a9d7468f12d7e90efc6d59d' },
];

function DepositTab() {
  const { user } = useAuth();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
    amount: 0
  });

  const copy = (s: string, addr: string) => navigator.clipboard?.writeText(addr).then(() => {
    setCopied(s); setTimeout(() => setCopied((c) => (c === s ? null : c)), 1500);
  });

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const formatted = cleaned.replace(/(.{4})/g, '$1 ').trim();
    return formatted.slice(0, 19);
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardForm(prev => ({ ...prev, cardNumber: formatted }));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    setCardForm(prev => ({ ...prev, expiryDate: formatted }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardForm(prev => ({ ...prev, [name]: value }));
  };

  const detectCardType = (cardNumber: string) => {
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (cleaned.startsWith('5')) return 'Mastercard';
    if (cleaned.startsWith('3')) return 'Amex';
    if (cleaned.startsWith('6')) return 'Discover';
    return 'Unknown';
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to deposit');
      return;
    }

    if (cardForm.amount <= 0) {
      setError('Please enter a valid amount (minimum $10)');
      return;
    }

    const cardDigits = cardForm.cardNumber.replace(/\s/g, '');
    if (cardDigits.length !== 16) {
      setError('Please enter a valid 16-digit card number');
      return;
    }

    if (cardForm.expiryDate.length !== 5) {
      setError('Please enter a valid expiry date (MM/YY)');
      return;
    }

    if (cardForm.cvv.length !== 3 && cardForm.cvv.length !== 4) {
      setError('Please enter a valid CVV');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: increment(cardForm.amount),
        depositHistory: [
          {
            amount: cardForm.amount,
            cardLast4: cardForm.cardNumber.slice(-4),
            cardType: detectCardType(cardForm.cardNumber),
            timestamp: new Date().toISOString(),
            status: 'completed'
          }
        ]
      });

      setSuccess(true);
      setCardForm({
        cardNumber: '',
        cardHolder: '',
        expiryDate: '',
        cvv: '',
        amount: 0
      });

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Deposit error:', err);
      setError('Failed to process deposit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card Deposit Form */}
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-2">💳 Quick Card Deposit</h3>
        <p className="text-muted text-sm mb-4">Fund your account instantly with your card</p>

        {success ? (
          <div className="text-center py-4 border-2 border-green-500 rounded-xl">
            <div className="text-4xl mb-2">✅</div>
            <h4 className="text-xl font-bold text-green-500">Deposit Successful!</h4>
            <p className="text-muted mt-1">
              ${cardForm.amount} has been added to your balance.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-3 btn-gold text-sm"
            >
              Make Another Deposit
            </button>
          </div>
        ) : (
          <form onSubmit={handleCardSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Amount (USD)</label>
              <input
                type="number"
                name="amount"
                value={cardForm.amount || ''}
                onChange={handleChange}
                min="10"
                step="10"
                placeholder="Enter amount (min $10)"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Card Number</label>
              <input
                type="text"
                name="cardNumber"
                value={cardForm.cardNumber}
                onChange={handleCardNumberChange}
                placeholder="1234 5678 9012 3456"
                className="input w-full"
                maxLength={19}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Card Holder Name</label>
              <input
                type="text"
                name="cardHolder"
                value={cardForm.cardHolder}
                onChange={handleChange}
                placeholder="John Doe"
                className="input w-full"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Expiry Date</label>
                <input
                  type="text"
                  name="expiryDate"
                  value={cardForm.expiryDate}
                  onChange={handleExpiryChange}
                  placeholder="MM/YY"
                  className="input w-full"
                  maxLength={5}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">CVV</label>
                <input
                  type="password"
                  name="cvv"
                  value={cardForm.cvv}
                  onChange={handleChange}
                  placeholder="•••"
                  className="input w-full"
                  maxLength={4}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-3 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Deposit Funds'}
            </button>

            <p className="text-xs text-muted text-center mt-2">
              🔒 Your card details are securely encrypted
            </p>
          </form>
        )}
      </div>

      {/* Crypto Deposit Addresses */}
      <div className="card p-5">
        <h3 className="font-semibold mb-1">🪙 Crypto Deposit</h3>
        <p className="text-muted text-sm mb-5">Send only the matching asset on the correct network. Addresses are hidden by default — tap the eye to reveal.</p>
        <div className="space-y-3">
          {DEPOSIT_ASSETS.map((a) => {
            const show = !!revealed[a.sym];
            return (
              <div key={a.sym} className="rounded-xl border border-border bg-bg-soft p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="grid place-items-center h-9 w-9 rounded-full text-black font-bold" style={{ background: a.color }}>{a.glyph}</span>
                  <div><p className="font-medium text-sm">{a.name} <span className="text-muted">({a.sym})</span></p><p className="text-[11px] text-muted">{a.network}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs sm:text-sm bg-bg rounded-lg px-3 py-2 border border-border break-all">
                    {show ? a.address : '•'.repeat(34)}
                  </code>
                  <button type="button" onClick={() => setRevealed((r) => ({ ...r, [a.sym]: !r[a.sym] }))}
                    aria-label={show ? 'Hide address' : 'Reveal address'}
                    className="grid place-items-center h-9 w-9 rounded-lg border border-border hover:bg-bg-hover text-muted">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" onClick={() => copy(a.sym, a.address)} disabled={!show} aria-label="Copy address"
                    className="grid place-items-center h-9 w-9 rounded-lg border border-border hover:bg-bg-hover text-muted disabled:opacity-40">
                    {copied === a.sym ? <Check size={16} className="text-up" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-5">Demo addresses for layout only. Once a deposit is confirmed by an administrator, your balance is credited and appears on your Portfolio automatically.</p>
      </div>
    </div>
  );
}

// Activity Tab Component
function ActivityTab({ uid }: { uid: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => listenUserActivity(uid, setItems), [uid]);
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3">Your account activity</h3>
      <div className="space-y-2">
        {items.map((a) => (
          <div key={a.id} className="flex justify-between text-sm border-b border-border/40 py-2">
            <span className="capitalize">{String(a.type).replace('_', ' ')} <span className="text-muted text-xs">· {a.device}</span></span>
            <span className="text-xs text-muted">{a.timestamp?.toDate?.().toLocaleString?.() ?? '—'}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-muted text-sm">No activity yet.</p>}
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({ uid, email, name }: { uid: string; email: string; name: string }) {
  const [displayName, setName] = useState(name ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => { await updateDisplayName(uid, displayName); setMsg('Saved.'); };
  const reset = async () => { try { await fbResetPassword(email); setMsg('Password reset email sent.'); } catch { setMsg('Could not send reset email.'); } };
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold mb-3">Profile</h3>
        <label className="text-xs text-muted block mb-1">Display name</label>
        <input className="input max-w-sm" value={displayName} onChange={(e) => setName(e.target.value)} aria-label="Display name" />
        <div className="mt-3"><button type="button" className="btn-gold" onClick={save}>Save</button></div>
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2"><ShieldCheck size={18} className="text-gold" /><h3 className="font-semibold">Security</h3></div>
        <p className="text-sm text-muted mb-3">Send a password-reset link to <b className="text-white">{email}</b>.</p>
        <button type="button" className="btn-ghost" onClick={reset}>Send password reset email</button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}

// Metric Component
function Metric({ label, value, className, highlight }: { label: string; value: string; className?: string; highlight?: boolean }) {
  return (
    <div className={cn('card p-5', highlight && 'border-gold/40')}>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('text-2xl font-bold mt-1 tabular-nums', className)}>{value}</p>
    </div>
  );
}

// MAIN DASHBOARD COMPONENT - This must have a default export
export default function DashboardPage() {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('portfolio');

  useEffect(() => {
    if (initialized && !user) router.replace('/login');
  }, [initialized, user, router]);

  if (!initialized) return <div className="min-h-screen grid place-items-center text-muted">Loading dashboard…</div>;
  if (!user) return null;

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'portfolio', label: 'Portfolio', icon: Wallet },
    { key: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'kyc', label: 'Verification', icon: Shield },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="space-y-1">
          <div className="card p-4 mb-4">
            <p className="font-semibold">{user.displayName ?? 'Trader'}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-bg-hover text-gold">{user.role}</span>
          </div>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                tab === t.key ? 'bg-bg-hover text-gold' : 'text-muted hover:text-white')}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </aside>

        <section>
          {tab === 'portfolio' && <PortfolioTab balance={user.balance ?? 0} />}
          {tab === 'deposit' && <DepositTab />}
          {tab === 'activity' && <ActivityTab uid={user.uid} />}
          {tab === 'kyc' && <KYCForm />}
          {tab === 'settings' && <SettingsTab uid={user.uid} email={user.email} name={user.displayName} />}
        </section>
      </main>
    </div>
  );
}