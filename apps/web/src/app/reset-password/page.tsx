'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { api, apiError } from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!token) return <p className="text-down text-sm">Missing or invalid reset token.</p>;
  if (done) return (
    <p className="text-sm text-muted">
      Password updated. <Link href="/login" className="text-gold">Log in</Link> with your new password.
    </p>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <input className="input" type="password" placeholder="New password" value={password}
        onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="text-down text-sm">{error}</p>}
      <button className="btn-gold w-full" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password">
      <Suspense fallback={<p className="text-muted text-sm">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
