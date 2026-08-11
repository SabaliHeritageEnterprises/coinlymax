'use client';

import { create } from 'zustand';
import type { Ticker, MarketPair } from '@/lib/types';

// APIs
const COINLORE_URL = 'https://api.coinlore.net/api';
const FOREX_URL = 'https://www.live-rates.com/rates';

interface MarketState {
  tickers: Record<string, Ticker>;
  allPairs: MarketPair[];
  filteredPairs: MarketPair[];
  searchQuery: string;
  selectedType: 'ALL' | 'CRYPTO' | 'FOREX';
  isLoading: boolean;
  lastUpdate: Date | null;
  setSnapshot: (list: Ticker[]) => void;
  upsert: (t: Ticker) => void;
  setPairs: (pairs: MarketPair[]) => void;
  setSearch: (query: string) => void;
  setType: (type: 'ALL' | 'CRYPTO' | 'FOREX') => void;
  fetchRealPrices: () => Promise<void>;
}

export const useMarket = create<MarketState>((set, get) => ({
  tickers: {},
  allPairs: [],
  filteredPairs: [],
  searchQuery: '',
  selectedType: 'ALL',
  isLoading: true,
  lastUpdate: null,
  
  setSnapshot: (list) => {
    const next: Record<string, Ticker> = {};
    for (const t of list) next[t.symbol] = t;
    set({ tickers: next, isLoading: false });
  },
  
  upsert: (t) => set((s) => ({ 
    tickers: { ...s.tickers, [t.symbol]: t },
    isLoading: false,
  })),
  
  setPairs: (pairs) => {
    set({ allPairs: pairs, filteredPairs: pairs });
  },
  
  setSearch: (query) => {
    const { allPairs, selectedType } = get();
    let filtered = allPairs;
    
    if (selectedType !== 'ALL') {
      filtered = filtered.filter(p => p.type === selectedType);
    }
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(p => 
        p.displayName.toLowerCase().includes(lowerQuery) ||
        p.symbol.toLowerCase().includes(lowerQuery)
      );
    }
    
    set({ searchQuery: query, filteredPairs: filtered });
  },
  
  setType: (type) => {
    const { allPairs, searchQuery } = get();
    let filtered = allPairs;
    
    if (type !== 'ALL') {
      filtered = filtered.filter(p => p.type === type);
    }
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.displayName.toLowerCase().includes(lowerQuery) ||
        p.symbol.toLowerCase().includes(lowerQuery)
      );
    }
    
    set({ selectedType: type, filteredPairs: filtered });
  },
  
  fetchRealPrices: async () => {
    try {
      // Fetch crypto from CoinLore
      const cryptoResponse = await fetch(`${COINLORE_URL}/tickers/?limit=150`);
      const cryptoData = await cryptoResponse.json();
      
      // Fetch forex rates
      let forexRates: any = {};
      try {
        const forexResponse = await fetch(FOREX_URL);
        forexRates = await forexResponse.json();
      } catch (error) {
        console.error('Forex fetch failed:', error);
      }
      
      const newTickers: Record<string, Ticker> = {};
      const newPairs: MarketPair[] = [];
      
      // Process crypto
      if (cryptoData.data && Array.isArray(cryptoData.data)) {
        cryptoData.data.forEach((coin: any) => {
          const price = parseFloat(coin.price_usd);
          const change = parseFloat(coin.percent_change_24h);
          
          newTickers[coin.symbol] = {
            symbol: coin.symbol,
            price: price,
            change24h: change,
            high24h: price * 1.02,
            low24h: price * 0.98,
            volume24h: parseFloat(coin.volume24),
            ts: Date.now(),
          };
          
          newPairs.push({
            id: coin.id,
            symbol: coin.symbol,
            base: coin.symbol,
            quote: 'USD',
            displayName: coin.name,
            type: 'CRYPTO',
            lastPrice: coin.price_usd,
            change24h: coin.percent_change_24h,
            high24h: (price * 1.02).toString(),
            low24h: (price * 0.98).toString(),
            volume24h: coin.volume24,
            marketCap: coin.market_cap_usd,
            pricePrecision: price < 1 ? 4 : 2,
            qtyPrecision: 6,
            isTrending: change > 5,
          });
        });
      }
      
      // Add forex pairs
      const forexPairs = [
        { symbol: 'EURUSD', name: 'Euro / US Dollar', changeKey: 'EURUSD_Change' },
        { symbol: 'GBPUSD', name: 'British Pound / US Dollar', changeKey: 'GBPUSD_Change' },
        { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', changeKey: 'USDJPY_Change' },
        { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', changeKey: 'AUDUSD_Change' },
        { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', changeKey: 'USDCAD_Change' },
        { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', changeKey: 'USDCHF_Change' },
        { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', changeKey: 'NZDUSD_Change' },
      ];
      
      forexPairs.forEach((pair, idx) => {
        const price = forexRates[pair.symbol] || 1.0;
        const change = forexRates[pair.changeKey] || '0';
        
        newTickers[pair.symbol] = {
          symbol: pair.symbol,
          price: parseFloat(price),
          change24h: parseFloat(change),
          high24h: parseFloat(price) * 1.005,
          low24h: parseFloat(price) * 0.995,
          volume24h: 0,
          ts: Date.now(),
        };
        
        newPairs.push({
          id: `forex_${idx}`,
          symbol: pair.symbol,
          base: pair.symbol.substring(0, 3),
          quote: pair.symbol.substring(3),
          displayName: pair.name,
          type: 'FOREX',
          lastPrice: price.toString(),
          change24h: change,
          high24h: (parseFloat(price) * 1.005).toString(),
          low24h: (parseFloat(price) * 0.995).toString(),
          volume24h: '0',
          marketCap: '',
          pricePrecision: 4,
          qtyPrecision: 4,
          isTrending: parseFloat(change) > 0,
        });
      });
      
      set({ 
        tickers: newTickers, 
        allPairs: newPairs, 
        filteredPairs: newPairs, 
        isLoading: false,
        lastUpdate: new Date()
      });
      
      console.log(`🔄 Live update: ${newPairs.length} pairs loaded at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error('Failed to fetch live prices:', error);
      set({ isLoading: false });
    }
  },
}));

// Auto-refresh every 15 seconds for truly live data
if (typeof window !== 'undefined') {
  // Initial fetch
  useMarket.getState().fetchRealPrices();
  
  // Refresh every 15 seconds
  const interval = setInterval(() => {
    useMarket.getState().fetchRealPrices();
  }, 15000);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
  });
}