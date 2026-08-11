'use client';

import { useState } from 'react';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useMarket } from '@/store/market';
import { fmtPrice, cn } from '@/lib/utils';
import { saveUserTrade, saveUserPosition, saveUserOrder, updateUserBalance } from '@/lib/fb';
import { auth, db } from '@/components/firebase'; // ✅ ADDED db
import { collection, addDoc } from 'firebase/firestore';
import type { MarketPair, OrderSide, OrderType } from '@/lib/types';

interface Props {
  pair: MarketPair;
  onPlaced?: () => void;
}

export function OrderPanel({ pair, onPlaced }: Props) {
  const { user, updateBalance, addPosition, addOrder, addTradeHistory, loadUserData } = useAuth();
  const live = useMarket((s) => s.tickers[pair.symbol]);
  
  // ─── GET PRICE (already validated in ws.ts) ─────────────────────
  const lastPrice = live?.price ?? Number(pair.lastPrice);

  const [side, setSide] = useState<OrderSide>('BUY');
  const [type, setType] = useState<OrderType>('MARKET');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const effectivePrice = type === 'MARKET' ? lastPrice : parseFloat(price) || 0;
  const total = (parseFloat(quantity) || 0) * effectivePrice;

  const getRandomPercentage = () => {
    return Math.floor(Math.random() * (25 - 10 + 1) + 10);
  };

  const submit = async () => {
    setMsg(null);
    if (!user) { setMsg('Please log in to trade.'); return; }
    if (!quantity || parseFloat(quantity) <= 0) { setMsg('Enter a quantity.'); return; }
    
    setBusy(true);
    
    try {
      const qty = parseFloat(quantity);
      const price = effectivePrice;
      
      // ─── 1. CALCULATE USDT COST ──────────────────────────────────
      const usdtCost = qty * price;
      
      console.log('📊 Trade calculation:');
      console.log(`   Side: ${side}`);
      console.log(`   Quantity: ${qty} ${pair.base}`);
      console.log(`   Price: $${price.toFixed(4)}`);
      console.log(`   USDT Cost: $${usdtCost.toFixed(2)}`);
      console.log(`   Balance: $${user.balance.toFixed(2)}`);
      
      // ─── 2. CHECK BALANCE ──────────────────────────────────────
      if (usdtCost > user.balance) {
        setMsg(`❌ Insufficient USDT! Need: $${usdtCost.toFixed(2)}, Have: $${user.balance.toFixed(2)}`);
        setBusy(false);
        return;
      }
      
      // ─── 3. DEDUCT USDT ──────────────────────────────────────────
      const newBalance = user.balance - usdtCost;
      
      // ─── 4. UPDATE BALANCE ──────────────────────────────────────
      await updateUserBalance(user.uid, newBalance);
      await updateBalance(newBalance);
      console.log('✅ Balance updated:', newBalance);
      
      const randomPercent = getRandomPercentage();
      const increaseAmount = user.balance * (randomPercent / 100);
      
      const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // ─── 5. SAVE TRADE TO PENDING TRADES COLLECTION ──────────────
      const tradeData = {
        id: tradeId,
        symbol: pair.symbol,
        side: side,
        type: type,
        price: price,
        quantity: qty,
        total: usdtCost,
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        pnl: increaseAmount,
        percentageGain: randomPercent,
        approved: false,
        approvedBy: null,
        approvedAt: null,
        userId: user.uid,
        userEmail: user.email,
        userDisplayName: user.displayName || user.email?.split('@')[0] || 'Trader',
      };
      
      // ✅ Save to pendingTrades collection (root level)
      const pendingRef = collection(db, 'pendingTrades');
      const pendingDocRef = await addDoc(pendingRef, tradeData);
      console.log('✅ Trade saved to pendingTrades collection:', pendingDocRef.id);
      
      // ─── 6. SAVE TO LOCAL STATE ─────────────────────────────────
      await addTradeHistory(tradeData);
      console.log('✅ Trade saved to local state as PENDING');
      
      // ─── 7. SAVE ORDER ──────────────────────────────────────────
      const orderData = {
        id: orderId,
        symbol: pair.symbol,
        side: side,
        type: type,
        price: price,
        quantity: qty,
        status: 'PENDING' as const,
        createdAt: new Date().toISOString(),
      };
      
      await saveUserOrder(user.uid, orderData);
      await addOrder(orderData);
      
      // ─── 8. SAVE POSITION (if BUY) ─────────────────────────────
      if (side === 'BUY') {
        const posId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const positionData = {
          id: posId,
          symbol: pair.symbol,
          side: side,
          entryPrice: price,
          quantity: qty,
          currentPrice: price,
          pnl: 0,
          openTime: new Date().toISOString(),
          status: 'OPEN' as const,
          approved: false,
        };
        
        await saveUserPosition(user.uid, positionData);
        await addPosition(positionData);
      }
      
      // ─── 9. RELOAD USER DATA ──────────────────────────────────
      await loadUserData(user.uid);
      
     setMsg(`✅ ${side} order submitted for ${qty} ${pair.base} | Pending.`);
      
      if (onPlaced) {
        onPlaced();
      }
      
      // ─── 10. BACKEND CALL ──────────────────────────────────────
      try {
        await api.post('/trades/orders', {
          symbol: pair.symbol,
          side,
          type,
          quantity: qty,
          ...(type !== 'MARKET' ? { price: price } : {}),
          ...(stopLoss ? { stopLoss: parseFloat(stopLoss) } : {}),
          ...(takeProfit ? { takeProfit: parseFloat(takeProfit) } : {}),
        });
      } catch (e) {
        console.log('Backend not available (demo mode)');
      }
      
      setQuantity('');
      setPrice('');
    } catch (e) {
      console.error('❌ Trade error:', e);
      setMsg(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      {/* Buy / Sell toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-bg-soft rounded-lg mb-4">
        {(['BUY', 'SELL'] as OrderSide[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              'py-2 rounded-md font-semibold text-sm transition',
              side === s
                ? s === 'BUY' ? 'bg-up text-black' : 'bg-down text-white'
                : 'text-muted',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Order type */}
      <div className="flex gap-2 mb-4 text-xs">
        {(['MARKET', 'LIMIT', 'STOP_LIMIT'] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn('px-2 py-1 rounded', type === t ? 'bg-bg-hover text-gold' : 'text-muted')}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {type !== 'MARKET' && (
          <div className="block">
            <span className="text-xs text-muted mb-1 block">Price ({pair.quote})</span>
            <input className="input" value={price} onChange={(e) => setPrice(e.target.value)}
              placeholder={fmtPrice(lastPrice, pair.pricePrecision)} inputMode="decimal" />
          </div>
        )}
        <div className="block">
          <span className="text-xs text-muted mb-1 block">Amount ({pair.base})</span>
          <input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00" inputMode="decimal" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="block">
            <span className="text-xs text-muted mb-1 block">Stop loss</span>
            <input className="input" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="—" inputMode="decimal" />
          </div>
          <div className="block">
            <span className="text-xs text-muted mb-1 block">Take profit</span>
            <input className="input" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="—" inputMode="decimal" />
          </div>
        </div>

        <div className="flex justify-between text-xs text-muted pt-1">
          <span>Total</span>
          <span className="tabular-nums">{fmtPrice(total)} {pair.quote}</span>
        </div>
        {user && (
          <div className="flex justify-between text-xs text-muted">
            <span>Available</span>
            <span className="tabular-nums">{fmtPrice(user.balance ?? 0)} USDT</span>
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className={cn(
            'w-full py-2.5 rounded-lg font-semibold transition disabled:opacity-50',
            side === 'BUY' ? 'bg-up text-black' : 'bg-down text-white',
          )}
        >
          {busy ? 'Processing...' : `${side}`}
        </button>

        {msg && <p className="text-xs text-center">{msg}</p>}
        <p className="text-[10px] text-center text-muted">Trading involves risk. Review your order before placing</p>
      </div>
    </div>
  );
}