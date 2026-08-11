'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { TradingViewChart } from '@/components/trading-view-chart';
import { OrderPanel } from '@/components/order-panel';
import { useAuth } from '@/store/auth';
import { useMarket } from '@/store/market';
import { fmtPrice, fmtChange, cn } from '@/lib/utils';
import type { MarketPair } from '@/lib/types';
import type { Position, Order, TradeRecord } from '@/store/auth';

type BottomTab = 'positions' | 'orders' | 'history';

const COINLORE_URL = 'https://api.coinlore.net/api';

export default function TradeTerminal() {
  const params = useParams();
  const router = useRouter();
  const symbol = String(params.symbol).toUpperCase();
  const { user } = useAuth();
  const { positions, orders, tradeHistory, closePosition, cancelOrder, loadUserData } = useAuth();
  const { tickers } = useMarket();

  const [pairs, setPairs] = useState<MarketPair[]>([]);
  const [pair, setPair] = useState<MarketPair | null>(null);
  const [tab, setTab] = useState<BottomTab>('positions');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [realPrices, setRealPrices] = useState<Record<string, { price: number; change: number; high: number; low: number; volume: number }>>({});

  // Load user's trade data when user logs in
  useEffect(() => {
    if (user) {
      console.log('🔄 Loading user data for:', user.uid);
      loadUserData(user.uid).then(() => {
        console.log('✅ User data loaded, tradeHistory length:', tradeHistory.length);
      });
    }
  }, [user]);

  // Fetch real prices for ALL pairs from CoinLore API
  useEffect(() => {
    const fetchAllRealData = async () => {
      try {
        const response = await fetch(`${COINLORE_URL}/tickers/?limit=100`);
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
          const pricesMap: Record<string, { price: number; change: number; high: number; low: number; volume: number }> = {};
          const marketPairs: MarketPair[] = [];
          
          data.data.forEach((coin: any) => {
            const price = parseFloat(coin.price_usd);
            const change = parseFloat(coin.percent_change_24h);
            const high = price * 1.02;
            const low = price * 0.98;
            const volume = parseFloat(coin.volume24);
            
            pricesMap[coin.symbol] = { price, change, high, low, volume };
            pricesMap[coin.symbol + 'USD'] = { price, change, high, low, volume };
            
            marketPairs.push({
              id: coin.id,
              symbol: coin.symbol,
              base: coin.symbol,
              quote: 'USD',
              displayName: coin.name + ' / USD',
              type: 'CRYPTO',
              lastPrice: coin.price_usd,
              change24h: coin.percent_change_24h,
              high24h: high.toString(),
              low24h: low.toString(),
              volume24h: coin.volume24,
              marketCap: coin.market_cap_usd,
              pricePrecision: price < 1 ? 4 : 2,
              qtyPrecision: 6,
              isTrending: change > 5,
            });
          });
          
          setPairs(marketPairs);
          setRealPrices(pricesMap);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch real data:', error);
        setIsLoading(false);
      }
    };
    
    fetchAllRealData();
    const interval = setInterval(fetchAllRealData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pairs.length === 0) return;
    let found = pairs.find(p => p.symbol === symbol);
    if (!found) {
      const baseSymbol = symbol.replace('USD', '').replace('USDT', '');
      found = pairs.find(p => p.symbol === baseSymbol);
    }
    if (!found && pairs.length > 0) {
      found = pairs[0];
    }
    setPair(found || null);
  }, [symbol, pairs]);

  // Refresh user data after trade
  const refreshUserData = async () => {
    if (user) {
      console.log('🔄 Refreshing user data after trade...');
      await loadUserData(user.uid);
      setRefreshTrigger(prev => prev + 1);
      console.log('✅ User data refreshed, tradeHistory length:', tradeHistory.length);
    }
  };

  const currentPairData = pair ? realPrices[pair.symbol] || realPrices[pair.base] : null;
  const liveTicker = pair ? tickers[pair.symbol] : null;
  
  const displayPrice = currentPairData?.price ?? liveTicker?.price ?? (pair ? parseFloat(pair.lastPrice) : 0);
  const displayChange = currentPairData?.change ?? liveTicker?.change24h ?? (pair ? parseFloat(pair.change24h) : 0);
  const displayHigh = currentPairData?.high ?? liveTicker?.high24h ?? (pair ? parseFloat(pair.high24h) : 0);
  const displayLow = currentPairData?.low ?? liveTicker?.low24h ?? (pair ? parseFloat(pair.low24h) : 0);
  const up = displayChange >= 0;

  if (isLoading || pairs.length === 0) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-10 text-center text-muted">Loading real market data...</div>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-10 text-center text-muted">Market not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="border-b border-border bg-bg-soft">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center gap-6 overflow-x-auto">
          <div>
            <h1 className="text-xl font-bold">{pair.displayName}</h1>
            <span className="text-xs text-muted">{pair.type}</span>
          </div>
          <div className="text-right">
            <div className={cn('text-xl font-bold tabular-nums', up ? 'text-up' : 'text-down')}>
              {fmtPrice(displayPrice, pair.pricePrecision)}
            </div>
          </div>
          <Stat label="24h Change" value={fmtChange(displayChange)} className={up ? 'text-up' : 'text-down'} />
          <Stat label="24h High" value={fmtPrice(displayHigh, pair.pricePrecision)} />
          <Stat label="24h Low" value={fmtPrice(displayLow, pair.pricePrecision)} />
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-4 w-full flex-1">
        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-12 lg:col-span-2 card p-2 max-h-[600px] overflow-y-auto order-2 lg:order-1">
            <div className="text-xs font-semibold text-gold px-2 py-2 border-b border-border mb-2">MARKETS</div>
            {pairs.slice(0, 30).map((p) => {
              const pairData = realPrices[p.symbol] || realPrices[p.base];
              const pc = pairData?.change ?? (tickers[p.symbol]?.change24h ?? parseFloat(p.change24h));
              return (
                <button
                  key={p.id}
                  onClick={() => router.push(`/trade/${p.symbol}`)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-bg-hover',
                    p.symbol === pair.symbol && 'bg-bg-hover'
                  )}
                >
                  <span className="truncate">{p.displayName}</span>
                  <span className={cn('text-xs tabular-nums ml-2', pc >= 0 ? 'text-up' : 'text-down')}>
                    {pc >= 0 ? '+' : ''}{fmtChange(pc)}
                  </span>
                </button>
              );
            })}
          </aside>

          <section className="col-span-12 lg:col-span-7 order-1 lg:order-2">
            <TradingViewChart symbol={pair.symbol} type={pair.type} height={560} />
          </section>

          <section className="col-span-12 lg:col-span-3 order-3">
            <OrderPanel 
              pair={{...pair, lastPrice: displayPrice.toString()}} 
              onPlaced={refreshUserData} 
            />
          </section>
        </div>

        <div className="card mt-4">
          <div className="flex gap-1 border-b border-border p-2">
            {(['positions', 'orders', 'history'] as BottomTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn('px-3 py-1.5 rounded text-sm capitalize',
                  tab === t ? 'bg-bg-hover text-gold' : 'text-muted')}
              >
                {t === 'positions' ? 'Open Positions' : t === 'orders' ? 'Open Orders' : 'Trade History'}
              </button>
            ))}
          </div>

          <div className="p-2 overflow-x-auto">
            {!user ? (
              <p className="p-6 text-center text-muted text-sm">Log in to view your positions and orders.</p>
            ) : tab === 'positions' ? (
              <PositionsTable positions={positions.filter(p => p.status === 'OPEN')} onClose={closePosition} />
            ) : tab === 'orders' ? (
              <OrdersTable orders={orders} onCancel={cancelOrder} />
            ) : (
              <HistoryTable trades={tradeHistory} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={cn('text-sm tabular-nums', className)}>{value}</div>
    </div>
  );
}

function PositionsTable({ positions, onClose }: { positions: Position[]; onClose: (id: string) => void }) {
  if (positions.length === 0) {
    return <p className="p-6 text-center text-muted text-sm">No open positions.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-left">
            <th className="p-2">Pair</th>
            <th className="p-2">Side</th>
            <th className="p-2 text-right">Qty</th>
            <th className="p-2 text-right">Entry</th>
            <th className="p-2 text-right">Current</th>
            <th className="p-2 text-right">PnL</th>
            <th className="p-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const pnl = (p.currentPrice - p.entryPrice) * p.quantity;
            return (
              <tr key={p.id} className="border-t border-border/50">
                <td className="p-2">{p.symbol}</td>
                <td className={cn('p-2', p.side === 'BUY' ? 'text-up' : 'text-down')}>{p.side}</td>
                <td className="p-2 text-right tabular-nums">{p.quantity}</td>
                <td className="p-2 text-right tabular-nums">{fmtPrice(p.entryPrice)}</td>
                <td className="p-2 text-right tabular-nums">{fmtPrice(p.currentPrice)}</td>
                <td className={cn('p-2 text-right tabular-nums', pnl >= 0 ? 'text-up' : 'text-down')}>{fmtPrice(pnl)}</td>
                <td className="p-2 text-right">
                  <button onClick={() => onClose(p.id)} className="text-gold hover:underline text-xs">Close</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ orders, onCancel }: { orders: Order[]; onCancel: (id: string) => void }) {
  if (orders.length === 0) {
    return <p className="p-6 text-center text-muted text-sm">No orders.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-left">
            <th className="p-2">Pair</th>
            <th className="p-2">Side</th>
            <th className="p-2 text-right">Price</th>
            <th className="p-2 text-right">Qty</th>
            <th className="p-2">Status</th>
            <th className="p-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border/50">
              <td className="p-2">{o.symbol}</td>
              <td className={cn('p-2', o.side === 'BUY' ? 'text-up' : 'text-down')}>{o.side}</td>
              <td className="p-2 text-right tabular-nums">{fmtPrice(o.price)}</td>
              <td className="p-2 text-right tabular-nums">{o.quantity}</td>
              <td className="p-2 text-xs">{o.status}</td>
              <td className="p-2 text-right">
                {o.status === 'PENDING' && (
                  <button onClick={() => onCancel(o.id)} className="text-down hover:underline text-xs">Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTable({ trades }: { trades: TradeRecord[] }) {
  if (!trades || trades.length === 0) {
    return <p className="p-6 text-center text-muted text-sm">No trade history yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-left">
            <th className="p-2">Pair</th>
            <th className="p-2">Side</th>
            <th className="p-2 text-right">Price</th>
            <th className="p-2 text-right">Qty</th>
            <th className="p-2 text-right">Total</th>
            <th className="p-2 text-right">Gain</th>
            <th className="p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-t border-border/50">
              <td className="p-2">{t.symbol}</td>
              <td className={cn('p-2', t.side === 'BUY' ? 'text-up' : 'text-down')}>{t.side}</td>
              <td className="p-2 text-right tabular-nums">{fmtPrice(t.price)}</td>
              <td className="p-2 text-right tabular-nums">{t.quantity}</td>
              <td className="p-2 text-right tabular-nums">{fmtPrice(t.total)}</td>
              <td className="text-up text-right text-sm">+{t.percentageGain}%</td>
              <td className="p-2 text-right text-xs text-muted">{new Date(t.timestamp).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}