'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { useAuth } from '@/store/auth';

function authError(e: any): string {
  const code = e?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Invalid email or password.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
  if (code.includes('user-disabled')) return 'This account has been suspended.';
  return e?.message ?? 'Could not sign in.';
}

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (e) {
      setError(authError(e)); setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your CryptoCoin account">
      <form onSubmit={submit} className="space-y-4">
        <input className="input" type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-down text-sm">{error}</p>}
        <button type="submit" className="btn-gold w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </button>
      </form>
      <div className="flex justify-between text-sm mt-4 text-muted">
        <Link href="/forgot-password" className="hover:text-white">Forgot password?</Link>
        <Link href="/register" className="hover:text-gold">Create account</Link>
      </div>
    </AuthShell>
  );
}
