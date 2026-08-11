'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

// CoinLore API
const COINLORE_URL = 'https://api.coinlore.net/api';

type CoinData = {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
};

export function TopMovers() {
  const [gainers, setGainers] = useState<CoinData[]>([]);
  const [losers, setLosers] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTopMovers = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`${COINLORE_URL}/tickers/?limit=100`);
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        // Process all coins
        const allCoins: CoinData[] = data.data.map((coin: any) => ({
          symbol: coin.symbol,
          name: coin.name,
          price: parseFloat(coin.price_usd),
          change24h: parseFloat(coin.percent_change_24h),
          volume: parseFloat(coin.volume24),
        }));
        
        // Filter out stablecoins and zero volume
        const filteredCoins = allCoins.filter(coin => 
          Math.abs(coin.change24h) < 100 && 
          coin.volume > 100000 && 
          coin.price > 0.001
        );
        
        // Sort by 24h change
        const sortedByGain = [...filteredCoins].sort((a, b) => b.change24h - a.change24h);
        const sortedByLoss = [...filteredCoins].sort((a, b) => a.change24h - b.change24h);
        
        setGainers(sortedByGain.slice(0, 6));
        setLosers(sortedByLoss.slice(0, 6));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching top movers:', error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTopMovers();
    // Refresh every 20 seconds
    const interval = setInterval(fetchTopMovers, 20000);
    return () => clearInterval(interval);
  }, [fetchTopMovers]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="text-up" size={18} />
            <h3 className="font-semibold">Top Gainers</h3>
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-bg-hover rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownRight className="text-down" size={18} />
            <h3 className="font-semibold">Top Losers</h3>
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-bg-hover rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top Gainers */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-up/20 flex items-center justify-center">
              <ArrowUpRight className="text-up" size={14} />
            </div>
            <h3 className="font-semibold">Top Gainers</h3>
          </div>
          {refreshing && <span className="text-xs text-muted animate-pulse">updating...</span>}
        </div>
        <div className="space-y-3">
          {gainers.map((coin, idx) => (
            <Link
              key={coin.symbol}
              href={`/trade/${coin.symbol}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-hover transition group"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs text-muted w-6">#{idx + 1}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{coin.symbol}</div>
                  <div className="text-xs text-muted truncate max-w-[120px]">{coin.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono">
                  ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-up font-medium">
                  +{coin.change24h.toFixed(2)}%
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-down/20 flex items-center justify-center">
              <ArrowDownRight className="text-down" size={14} />
            </div>
            <h3 className="font-semibold">Top Losers</h3>
          </div>
          {refreshing && <span className="text-xs text-muted animate-pulse">updating...</span>}
        </div>
        <div className="space-y-3">
          {losers.map((coin, idx) => (
            <Link
              key={coin.symbol}
              href={`/trade/${coin.symbol}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-hover transition group"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs text-muted w-6">#{idx + 1}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{coin.symbol}</div>
                  <div className="text-xs text-muted truncate max-w-[120px]">{coin.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono">
                  ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-down font-medium">
                  {coin.change24h.toFixed(2)}%
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}