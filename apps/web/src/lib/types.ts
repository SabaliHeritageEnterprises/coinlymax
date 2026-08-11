export type MarketType = 'CRYPTO' | 'FOREX';

export interface MarketPair {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  displayName: string;
  type: MarketType;
  lastPrice: string;
  change24h: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  marketCap: string;
  pricePrecision: number;
  qtyPrecision: number;
  isTrending: boolean;
}

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  ts: number;
  _logged?: boolean; // ✅ ADD THIS - for tracking logged symbols in ws.ts
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  status: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  paperBalance: string;
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LIMIT';
export type OrderStatus = 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';

export interface Trade {
  id: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: string;
  quantity: string;
  filledPrice?: string;
  notional: string;
  createdAt: string;
  pair: { symbol: string; displayName: string };
}

export interface Position {
  id: string;
  side: OrderSide;
  status: 'OPEN' | 'CLOSED';
  entryPrice: string;
  quantity: string;
  markPrice?: number;
  unrealizedPnl?: number;
  pair: { symbol: string; displayName: string; lastPrice: string };
}