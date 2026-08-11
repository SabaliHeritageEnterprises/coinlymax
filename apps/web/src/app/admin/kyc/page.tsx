'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { db } from '@/components/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { isAdmin } from '@/lib/fb';
import { cn } from '@/lib/utils';
import { Check, X, User, Eye } from 'lucide-react';

interface KYCSubmission {
  uid: string;
  email: string;
  displayName: string;
  kyc: any;
  kycStatus: string;
  kycSubmittedAt: string;
}

export default function AdminKYC() {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<KYCSubmission | null>(null);

  useEffect(() => {
    if (initialized && (!user || !isAdmin(user.role))) {
      router.replace('/dashboard');
    }
  }, [initialized, user, router]);

  useEffect(() => {
    if (!user || !isAdmin(user.role)) return;

    const q = query(
      collection(db, 'users'),
      where('kycStatus', '==', 'pending')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const subs: KYCSubmission[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        subs.push({
          uid: doc.id,
          email: data.email,
          displayName: data.displayName,
          kyc: data.kyc,
          kycStatus: data.kycStatus,
          kycSubmittedAt: data.kycSubmittedAt,
        });
      });
      setSubmissions(subs);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const handleVerify = async (uid: string, approved: boolean, reason?: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        kycStatus: approved ? 'verified' : 'rejected',
        'kyc.status': approved ? 'verified' : 'rejected',
        'kyc.verifiedAt': approved ? new Date().toISOString() : null,
        'kyc.rejectionReason': reason || null,
      });

      setSubmissions(prev => prev.filter(s => s.uid !== uid));
      setSelected(null);
    } catch (error) {
      console.error('Error updating KYC:', error);
    }
  };

  if (!initialized || loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">🆔 KYC Verification</h1>
          <span className="text-xs px-3 py-1 rounded bg-bg-hover text-muted">
            {submissions.length} pending
          </span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-1 card p-4 max-h-[600px] overflow-y-auto">
            <h2 className="font-semibold mb-3 text-sm text-muted">Pending Submissions</h2>
            {submissions.length === 0 ? (
              <div className="text-center text-muted text-sm py-8">
                <Check className="mx-auto mb-2 text-green-500" size={32} />
                All clear! No pending KYC submissions.
              </div>
            ) : (
              submissions.map((sub) => (
                <div
                  key={sub.uid}
                  onClick={() => setSelected(sub)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer hover:bg-bg-hover transition-colors mb-2 border border-transparent',
                    selected?.uid === sub.uid && 'bg-bg-hover border-gold'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{sub.displayName || 'Unknown'}</p>
                      <p className="text-xs text-muted">{sub.email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500">
                      Pending
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Submitted: {sub.kycSubmittedAt ? new Date(sub.kycSubmittedAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Submission Details */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="card p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold">{selected.displayName || 'Unknown User'}</h2>
                    <p className="text-muted text-sm">{selected.email}</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded bg-yellow-500/20 text-yellow-500">
                    Pending Review
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-bg-soft rounded-lg">
                  <div>
                    <p className="text-xs text-muted">Full Name</p>
                    <p className="font-medium">{selected.kyc?.firstName} {selected.kyc?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Date of Birth</p>
                    <p className="font-medium">{selected.kyc?.dateOfBirth}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Nationality</p>
                    <p className="font-medium">{selected.kyc?.nationality}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">ID Type</p>
                    <p className="font-medium capitalize">{selected.kyc?.idType?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">ID Number</p>
                    <p className="font-medium">{selected.kyc?.idNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Submitted</p>
                    <p className="font-medium">{selected.kycSubmittedAt ? new Date(selected.kycSubmittedAt).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>

                <div className="mb-6 p-4 bg-bg-soft rounded-lg">
                  <p className="text-xs text-muted">Address</p>
                  <p className="font-medium">
                    {selected.kyc?.address}, {selected.kyc?.city}, {selected.kyc?.country} {selected.kyc?.postalCode}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleVerify(selected.uid, true)}
                    className="flex-1 bg-green-500 text-black font-medium py-3 rounded-lg hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check size={18} /> Verify Identity
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:');
                      if (reason !== null) {
                        handleVerify(selected.uid, false, reason || 'Invalid documents');
                      }
                    }}
                    className="flex-1 bg-red-500 text-white font-medium py-3 rounded-lg hover:bg-red-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={18} /> Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center text-muted">
                <User size={64} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg">Select a submission to review</p>
                <p className="text-sm">Click on any pending submission from the list</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}