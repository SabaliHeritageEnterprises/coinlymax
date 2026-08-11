'use client';

import Link from 'next/link';
import { useMarket } from '@/store/market';
import { fmtPrice, fmtChange, fmtCompact, cn } from '@/lib/utils';
import type { MarketPair } from '@/lib/types';
import { Star } from 'lucide-react';

interface Props {
  pairs: MarketPair[];
  favorites?: Set<string>;
  onToggleFavorite?: (symbol: string) => void;
  compact?: boolean;
}

/** Live-updating market list. Static pair data is enriched with WS tickers. */
export function MarketTable({ pairs, favorites, onToggleFavorite, compact }: Props) {
  const tickers = useMarket((s) => s.tickers);

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-border">
            {onToggleFavorite && <th className="p-3 w-8" />}
            <th className="p-3">Pair</th>
            <th className="p-3 text-right">Price</th>
            <th className="p-3 text-right">24h Change</th>
            {!compact && <th className="p-3 text-right hidden md:table-cell">24h High</th>}
            {!compact && <th className="p-3 text-right hidden md:table-cell">24h Volume</th>}
            <th className="p-3 text-right">Trade</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => {
            const t = tickers[p.symbol];
            const price = t?.price ?? Number(p.lastPrice);
            const change = t?.change24h ?? Number(p.change24h);
            const high = t?.high24h ?? Number(p.high24h);
            const vol = t?.volume24h ?? Number(p.volume24h);
            const up = change >= 0;
            
            return (
              <tr key={p.id} className="border-b border-border/50 hover:bg-bg-hover transition">
                {onToggleFavorite && (
                  <td className="p-3">
                    <button onClick={() => onToggleFavorite(p.symbol)} aria-label="Toggle favorite">
                      <Star
                        size={16}
                        className={cn(
                          favorites?.has(p.symbol) ? 'fill-gold text-gold' : 'text-muted',
                        )}
                      />
                    </button>
                  </td>
                )}
                <td className="p-3">
                  <Link href={`/trade/${p.symbol}`} className="flex items-center gap-2">
                    <span className="font-medium">{p.displayName}</span>
                    <span className="text-xs text-muted">{p.type}</span>
                  </Link>
                </td>
                <td className="p-3 text-right tabular-nums">{fmtPrice(price, p.pricePrecision)}</td>
                <td className={cn('p-3 text-right tabular-nums', up ? 'text-up' : 'text-down')}>
                  {fmtChange(change)}
                </td>
                {!compact && (
                  <td className="p-3 text-right tabular-nums hidden md:table-cell">
                    {fmtPrice(high, p.pricePrecision)}
                  </td>
                )}
                {!compact && (
                  <td className="p-3 text-right tabular-nums hidden md:table-cell">
                    {fmtCompact(vol)}
                  </td>
                )}
                <td className="p-3 text-right">
                  <Link href={`/trade/${p.symbol}`} className="text-gold hover:underline">
                    Trade
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}