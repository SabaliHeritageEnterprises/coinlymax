'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { db } from '@/components/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  orderBy,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { isAdmin, getProfitPercentage, updateProfitPercentage, listenProfitPercentage } from '@/lib/fb';

interface PendingTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: number;
  quantity: number;
  total: number;
  timestamp: string;
  status: string;
  pnl: number;
  percentageGain: number;
  approved: boolean;
  userId: string;
  userEmail: string;
  userDisplayName: string;
}

export default function AdminTrades() {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const processingIds = useRef<Set<string>>(new Set());

  // ✅ State for profit percentage
  const [profitPct, setProfitPct] = useState(15);
  const [isUpdatingPct, setIsUpdatingPct] = useState(false);

  // ✅ Load initial percentage and listen for changes
  useEffect(() => {
    const unsub = listenProfitPercentage((pct) => {
      setProfitPct(pct);
    });
    return () => unsub();
  }, []);

  // Guard: admins only
  useEffect(() => {
    if (initialized && (!user || !isAdmin(user.role))) {
      router.replace('/dashboard');
    }
  }, [initialized, user, router]);

  // Listener for pending trades
  useEffect(() => {
    if (!user || !isAdmin(user.role)) {
      console.log('⛔ AdminTrades: Not admin or no user');
      return;
    }

    console.log('🔍 AdminTrades: Setting up listener for pending trades...');

    const pendingRef = collection(db, 'pendingTrades');
    const q = query(
      pendingRef,
      where('status', '==', 'PENDING'),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      console.log('📨 AdminTrades: Snapshot size:', snapshot.size);
      const trades: PendingTrade[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'PENDING' && !processingIds.current.has(doc.id)) {
          trades.push({ id: doc.id, ...data } as PendingTrade);
        } else {
          console.log(`⏩ Skipping doc ${doc.id} (status: ${data.status} or processing)`);
        }
      });
      setPendingTrades(trades);
      setLoading(false);
    }, (error) => {
      console.error('❌ AdminTrades: Error in pending trades listener:', error);
      setLoading(false);
    });

    return () => {
      console.log('🧹 AdminTrades: Cleaning up listener');
      unsub();
    };
  }, [user]);

  // ✅ Handler to update profit percentage
  const handlePercentageUpdate = async () => {
    setIsUpdatingPct(true);
    try {
      await updateProfitPercentage(profitPct);
      alert('Profit percentage updated successfully!');
    } catch (error) {
      console.error('Failed to update percentage:', error);
      alert('Failed to update percentage. Please try again.');
    } finally {
      setIsUpdatingPct(false);
    }
  };

  // Approve handler
  const handleApprove = async (trade: PendingTrade) => {
    processingIds.current.add(trade.id);
    setApproving(trade.id);
    setPendingTrades(prev => prev.filter(t => t.id !== trade.id));

    try {
      if (!user) {
        alert('You must be logged in to approve trades.');
        throw new Error('Not logged in');
      }

      console.log('✅ Approving trade:', trade.id);

      // 1. Update user's balance
      const userRef = doc(db, 'users', trade.userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        alert('User document not found!');
        throw new Error('User not found');
      }
      const currentBalance = userDoc.data()?.balance || 0;
      const newBalance = currentBalance + trade.pnl;
      await updateDoc(userRef, { balance: newBalance });
      console.log('✅ Balance updated');

      // 2. Add to trades history
      const tradesRef = collection(db, 'trades');
      await addDoc(tradesRef, {
        ...trade,
        status: 'APPROVED',
        approved: true,
        approvedBy: user.uid,
        approvedAt: new Date().toISOString(),
        approvedEmail: user.email
      });
      console.log('✅ Trade added to history');

      // 3. Delete pending document (primary)
      const pendingRef = doc(db, 'pendingTrades', trade.id);
      try {
        await deleteDoc(pendingRef);
        console.log('✅ Pending trade deleted');
      } catch (deleteError) {
        console.warn('⚠️ Delete failed, trying to update status instead:', deleteError);
        await updateDoc(pendingRef, {
          status: 'APPROVED',
          approved: true,
          approvedBy: user.uid,
          approvedAt: new Date().toISOString(),
          approvedEmail: user.email
        });
        console.log('✅ Pending status updated to APPROVED');
      }

      // 4. Add activity log
      await addDoc(collection(db, 'activity'), {
        type: 'trade_approved',
        uid: user.uid,
        email: user.email,
        username: user.displayName || user.email,
        tradeId: trade.id,
        symbol: trade.symbol,
        amount: trade.total,
        pnl: trade.pnl,
        timestamp: serverTimestamp(),
        status: 'success'
      }).catch(() => {});

      // 5. Update position if BUY
      if (trade.side === 'BUY') {
        try {
          const positionsRef = collection(db, 'users', trade.userId, 'positions');
          const positionsQuery = query(
            positionsRef,
            where('symbol', '==', trade.symbol),
            where('entryPrice', '==', trade.price),
            where('quantity', '==', trade.quantity),
            where('status', '==', 'OPEN')
          );
          const positionsSnapshot = await getDocs(positionsQuery);
          positionsSnapshot.forEach(async (posDoc) => {
            await updateDoc(doc(db, 'users', trade.userId, 'positions', posDoc.id), {
              approved: true,
              approvedAt: new Date().toISOString()
            });
          });
          console.log('✅ Position updated');
        } catch (posError) {
          console.log('⚠️ No position found to update:', posError);
        }
      }

      alert('✅ Trade approved successfully!');
    } catch (error) {
      console.error('❌ Error approving trade:', error);
      alert(error instanceof Error ? `Failed to approve trade: ${error.message}` : 'Failed to approve trade.');
      processingIds.current.delete(trade.id);
    } finally {
      setApproving(null);
      processingIds.current.delete(trade.id);
    }
  };

  // Reject handler
  const handleReject = async (trade: PendingTrade) => {
    processingIds.current.add(trade.id);
    setApproving(trade.id);
    setPendingTrades(prev => prev.filter(t => t.id !== trade.id));

    try {
      if (!user) {
        alert('You must be logged in to reject trades.');
        throw new Error('Not logged in');
      }

      console.log('❌ Rejecting trade:', trade.id);

      // 1. Add to trades history
      const tradesRef = collection(db, 'trades');
      await addDoc(tradesRef, {
        ...trade,
        status: 'REJECTED',
        rejectedBy: user.uid,
        rejectedAt: new Date().toISOString()
      });
      console.log('✅ Trade added to history as REJECTED');

      // 2. Delete pending document (primary)
      const pendingRef = doc(db, 'pendingTrades', trade.id);
      try {
        await deleteDoc(pendingRef);
        console.log('✅ Pending trade deleted');
      } catch (deleteError) {
        console.warn('⚠️ Delete failed, updating status to REJECTED:', deleteError);
        await updateDoc(pendingRef, {
          status: 'REJECTED',
          rejectedBy: user.uid,
          rejectedAt: new Date().toISOString()
        });
        console.log('✅ Pending status updated to REJECTED');
      }

      // 3. Add activity log
      await addDoc(collection(db, 'activity'), {
        type: 'trade_rejected',
        uid: user.uid,
        email: user.email,
        username: user.displayName || user.email,
        tradeId: trade.id,
        symbol: trade.symbol,
        amount: trade.total,
        timestamp: serverTimestamp(),
        status: 'success'
      }).catch(() => {});

      alert('✅ Trade rejected successfully!');
    } catch (error) {
      console.error('❌ Error rejecting trade:', error);
      alert(error instanceof Error ? `Failed to reject trade: ${error.message}` : 'Failed to reject trade.');
      processingIds.current.delete(trade.id);
    } finally {
      setApproving(null);
      processingIds.current.delete(trade.id);
    }
  };

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading pending trades...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-8">
      <div className="max-w-6xl mx-auto">
        {/* ✅ Profit Percentage Control */}
        <div className="card p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-muted">Profit Percentage</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min="0"
                max="100"
                value={profitPct}
                onChange={(e) => setProfitPct(Number(e.target.value))}
                className="input w-24"
              />
              <span className="text-muted text-sm">%</span>
              <button
                onClick={handlePercentageUpdate}
                disabled={isUpdatingPct}
                className="btn-gold text-sm px-4 py-1.5"
              >
                {isUpdatingPct ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-muted mt-1">
              This percentage determines the simulated profit for all new trades.
            </p>
          </div>
        </div>

        {/* Pending Trades Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">📊 Trade Approvals</h1>
          <span className="text-xs px-3 py-1 rounded bg-yellow-500/20 text-yellow-500">
            {pendingTrades.length} pending
          </span>
        </div>

        {pendingTrades.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-lg">No pending trades to approve.</p>
            <p className="text-sm">All trades have been processed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTrades.map((trade) => (
              <div key={trade.id} className="card p-4 border border-[#23272f] hover:border-gold/30 transition-colors">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-sm ${trade.side === 'BUY' ? 'text-up' : 'text-down'}`}>
                        {trade.side}
                      </span>
                      <span className="text-sm font-medium">{trade.symbol}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500">
                        PENDING
                      </span>
                      {approving === trade.id && (
                        <span className="text-xs text-blue-400 animate-pulse">Processing...</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted">
                      <div>
                        <p>User</p>
                        <p className="text-white font-medium text-sm">{trade.userDisplayName || trade.userEmail}</p>
                      </div>
                      <div>
                        <p>Amount</p>
                        <p className="text-white font-medium text-sm">{trade.quantity.toFixed(4)} {trade.symbol.replace(/USDT$/, '')}</p>
                      </div>
                      <div>
                        <p>Price</p>
                        <p className="text-white font-medium text-sm">${trade.price.toFixed(2)}</p>
                      </div>
                      <div>
                        <p>Profit</p>
                        <p className="text-up font-medium text-sm">+${trade.pnl.toFixed(2)} ({trade.percentageGain}%)</p>
                      </div>
                      <div>
                        <p>Total</p>
                        <p className="text-white font-medium text-sm">${trade.total.toFixed(2)}</p>
                      </div>
                      <div>
                        <p>Submitted</p>
                        <p className="text-white text-xs">{new Date(trade.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(trade)}
                      disabled={approving === trade.id}
                      className="bg-green-500 text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-400 transition-colors disabled:opacity-50"
                    >
                      {approving === trade.id ? '...' : '✅ Approve'}
                    </button>
                    <button
                      onClick={() => { if (confirm('Reject this trade?')) handleReject(trade); }}
                      disabled={approving === trade.id}
                      className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-400 transition-colors disabled:opacity-50"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}