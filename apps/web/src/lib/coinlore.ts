// CoinLore API - Free, no API key required
import type { MarketPair } from '@/lib/types';

const COINLORE_URL = 'https://api.coinlore.net/api';

export type CoinLoreTicker = {
  id: string;
  symbol: string;
  name: string;
  nameid: string;
  rank: number;
  price_usd: string;
  percent_change_24h: string;
  percent_change_1h: string;
  percent_change_7d: string;
  market_cap_usd: string;
  volume24: string;
  csupply: string;
  tsupply: string;
  msupply: string | null;
};

export async function fetchTickers(start: number = 0, limit: number = 100): Promise<CoinLoreTicker[]> {
  try {
    const response = await fetch(`${COINLORE_URL}/tickers/?start=${start}&limit=${limit}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch tickers:', error);
    return [];
  }
}

export async function fetchAllTickers(): Promise<CoinLoreTicker[]> {
  let allTickers: CoinLoreTicker[] = [];
  let start = 0;
  const limit = 100;
  let hasMore = true;
  
  while (hasMore && allTickers.length < 2000) {
    const tickers = await fetchTickers(start, limit);
    if (tickers.length === 0) {
      hasMore = false;
    } else {
      allTickers = [...allTickers, ...tickers];
      start += limit;
    }
  }
  
  return allTickers;
}

export function convertToMarketPairs(tickers: CoinLoreTicker[]): MarketPair[] {
  return tickers.map((ticker, index) => ({
    id: ticker.id,
    symbol: ticker.symbol,
    base: ticker.symbol,
    quote: 'USD',
    displayName: ticker.name,
    type: 'CRYPTO',
    lastPrice: ticker.price_usd,
    change24h: ticker.percent_change_24h,
    high24h: (parseFloat(ticker.price_usd) * 1.02).toFixed(2),
    low24h: (parseFloat(ticker.price_usd) * 0.98).toFixed(2),
    volume24h: ticker.volume24,
    marketCap: ticker.market_cap_usd,
    pricePrecision: parseFloat(ticker.price_usd) < 1 ? 4 : 2,
    qtyPrecision: 6,
    isTrending: parseFloat(ticker.percent_change_24h) > 5,
  }));
}