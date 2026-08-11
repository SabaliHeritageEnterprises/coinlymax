'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { api, apiError } from '@/lib/api';

function Verifier() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setMsg('Missing token.'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((e) => { setState('error'); setMsg(apiError(e)); });
  }, [token]);

  if (state === 'loading') return <p className="text-muted text-sm">Verifying your email…</p>;
  if (state === 'ok') return (
    <p className="text-sm text-muted">
      ✓ Your email is verified. <Link href="/login" className="text-gold">Log in</Link> to start trading.
    </p>
  );
  return <p className="text-down text-sm">{msg}</p>;
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Email verification">
      <Suspense fallback={<p className="text-muted text-sm">Loading…</p>}>
        <Verifier />
      </Suspense>
    </AuthShell>
  );
}
