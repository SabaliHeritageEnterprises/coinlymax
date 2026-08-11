'use client';

import { liveMarketData } from './liveMarketData';
import type { Ticker } from '@/lib/types';

// Store tickers in memory
let tickersCache: Record<string, Ticker> = {};
let tickerCallbacks: ((tickers: Ticker[]) => void)[] = [];

// ─── PRICE VALIDATION ─────────────────────────────────────────────
function validatePrice(price: number, symbol: string): number {
  // If price is abnormally high (more than 1 million), divide by 10000
  let validatedPrice = price;
  
  if (validatedPrice > 1000000) {
    console.log(`⚠️ [${symbol}] Price too high: ${validatedPrice}, dividing by 10000`);
    validatedPrice = validatedPrice / 10000;
  }
  
  // If price is still too high, divide by 100 again
  if (validatedPrice > 1000000) {
    console.log(`⚠️ [${symbol}] Price still too high: ${validatedPrice}, dividing by 100`);
    validatedPrice = validatedPrice / 100;
  }
  
  // If price is too low (less than 0.0001), multiply by 10000
  if (validatedPrice < 0.0001 && validatedPrice > 0) {
    console.log(`⚠️ [${symbol}] Price too low: ${validatedPrice}, multiplying by 10000`);
    validatedPrice = validatedPrice * 10000;
  }
  
  return validatedPrice;
}

// Notify all subscribers when tickers update
function notifySubscribers() {
  const tickerArray = Object.values(tickersCache);
  tickerCallbacks.forEach(cb => cb([...tickerArray]));
}

// Subscribe to real-time data from Binance + Forex APIs
export function onTickers(callback: (tickers: Ticker[]) => void): () => void {
  // Add callback to list
  tickerCallbacks.push(callback);
  
  // Send current cache immediately if it has data
  if (Object.keys(tickersCache).length > 0) {
    callback(Object.values(tickersCache));
  }
  
  // Subscribe to individual symbols
  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 
    'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 
    'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'SHIBUSDT',
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 
    'USDCAD', 'NZDUSD', 'USDCHF'
  ];
  
  symbols.forEach(symbol => {
    liveMarketData.subscribe(symbol, (price, change24h, high, low, volume) => {
      // ✅ Validate and fix the price
      const validatedPrice = validatePrice(price, symbol);
      
      tickersCache[symbol] = {
        symbol,
        price: validatedPrice,
        change24h: parseFloat(change24h),
        high24h: high || 0,
        low24h: low || 0,
        volume24h: volume || 0,
        ts: Date.now(),
      };
      
      // Log first price for debugging
      if (!tickersCache[symbol]._logged) {
        console.log(`✅ [${symbol}] Price: $${validatedPrice.toFixed(4)}`);
        tickersCache[symbol]._logged = true;
      }
      
      notifySubscribers();
    });
  });
  
  // Connect to live data sources
  liveMarketData.connectCrypto();
  liveMarketData.connectForex();
  
  // Return unsubscribe function
  return () => {
    const index = tickerCallbacks.indexOf(callback);
    if (index > -1) tickerCallbacks.splice(index, 1);
  };
}

// Subscribe to a single symbol's ticker
export function onTicker(symbol: string, callback: (ticker: Ticker) => void): () => void {
  const handler = (price: number, change24h: string, high?: number, low?: number, volume?: number) => {
    const validatedPrice = validatePrice(price, symbol);
    
    callback({
      symbol,
      price: validatedPrice,
      change24h: parseFloat(change24h),
      high24h: high || 0,
      low24h: low || 0,
      volume24h: volume || 0,
      ts: Date.now(),
    });
  };
  
  liveMarketData.subscribe(symbol, handler);
  liveMarketData.connectCrypto();
  liveMarketData.connectForex();
  
  return () => {};
}

// Helper to get current tickers
export function getCurrentTickers(): Ticker[] {
  return Object.values(tickersCache);
}

// Disconnect all connections
export function disconnectMarketData() {
  liveMarketData.disconnect();
  tickerCallbacks = [];
  tickersCache = {};
}