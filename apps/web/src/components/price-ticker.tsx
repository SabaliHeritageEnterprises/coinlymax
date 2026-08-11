'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// CoinLore API - same as trade page
const COINLORE_URL = 'https://api.coinlore.net/api';

type TickerData = {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
};

export function PriceTicker() {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchAllTickers = async () => {
    try {
      const response = await fetch(`${COINLORE_URL}/tickers/?limit=150`);
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const formattedTickers: TickerData[] = data.data.map((coin: any) => ({
          symbol: coin.symbol,
          name: coin.name,
          price: parseFloat(coin.price_usd),
          change24h: parseFloat(coin.percent_change_24h),
        }));
        
        setTickers(formattedTickers);
        setLastUpdate(new Date());
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch tickers:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTickers();
    // Refresh every 20 seconds
    const interval = setInterval(fetchAllTickers, 20000);
    return () => clearInterval(interval);
  }, []);

  // Create triple array for seamless scrolling
  const scrollTickers = [...tickers, ...tickers, ...tickers];

  if (isLoading) {
    return (
      <div className="h-10 border-y border-border/60 bg-bg-soft flex items-center px-4 text-xs text-muted overflow-hidden">
        <div className="animate-pulse">Loading live market data from 150+ pairs...</div>
      </div>
    );
  }

  if (tickers.length === 0) {
    return (
      <div className="h-10 border-y border-border/60 bg-bg-soft flex items-center px-4 text-xs text-muted overflow-hidden">
        <div>Connecting to market data...</div>
      </div>
    );
  }

  return (
    <div className="h-10 border-y border-border/60 bg-bg-soft overflow-hidden relative">
      {/* Gradient overlays for smooth edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-soft to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-soft to-transparent z-10 pointer-events-none" />
      
      {/* Scrolling ribbon */}
      <div className="absolute inset-0 flex items-center">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-6 px-4">
          {scrollTickers.map((ticker, idx) => {
            const isPositive = ticker.change24h >= 0;
            return (
              <Link
                key={`${ticker.symbol}-${idx}`}
                href={`/trade/${ticker.symbol}`}
                className="inline-flex items-center gap-2 text-sm hover:opacity-80 transition group px-2 py-1 rounded hover:bg-bg-hover"
              >
                <span className="font-semibold text-gold text-xs uppercase">
                  {ticker.symbol}
                </span>
                <span className="tabular-nums text-white font-mono text-sm">
                  ${ticker.price.toLocaleString(undefined, { 
                    minimumFractionDigits: ticker.price < 1 ? 4 : 2,
                    maximumFractionDigits: ticker.price < 1 ? 4 : 2
                  })}
                </span>
                <span className={cn(
                  'tabular-nums text-xs font-medium px-1.5 py-0.5 rounded',
                  isPositive ? 'text-up bg-up/10' : 'text-down bg-down/10'
                )}>
                  {isPositive ? '+' : ''}{ticker.change24h.toFixed(2)}%
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      
      {/* Last update indicator (hidden on mobile) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted/50 hidden md:block z-20 pointer-events-none">
        Live
      </div>
    </div>
  );
}