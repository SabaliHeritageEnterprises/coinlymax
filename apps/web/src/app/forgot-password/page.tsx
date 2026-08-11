'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { useAuth } from '@/store/auth';

export default function ForgotPasswordPage() {
  const resetPassword = useAuth((s) => s.resetPassword);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e: any) {
      // Don't reveal whether the email exists.
      if (e?.code?.includes('invalid-email')) setError('Please enter a valid email address.');
      else setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we'll send a reset link.">
      {sent ? (
        <p className="text-sm text-muted">
          If an account exists for <b>{email}</b>, a password-reset email from Firebase is on its way.
          {' '}<Link href="/login" className="text-gold">Back to login</Link>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input className="input" type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="text-down text-sm">{error}</p>}
          <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <p className="text-sm text-center text-muted">
            <Link href="/login" className="hover:text-white">Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
