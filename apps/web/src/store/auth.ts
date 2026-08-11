'use client';

import { create } from 'zustand';
import { 
  fbRegister, fbLogin, fbLogout, fbResetPassword, updateUserBalance, type AppUser,
  saveUserTrade, saveUserPosition, saveUserOrder,
  loadUserTrades, loadUserPositions, loadUserOrders,
  updatePositionStatus, updateOrderStatus,
  type UserTrade, type UserPosition, type UserOrder
} from '@/lib/fb';

// Re-export types for use in other files
export type TradeRecord = UserTrade;
export type Position = UserPosition;
export type Order = UserOrder;

interface AuthState {
  user: AppUser | null;
  initialized: boolean;
  loading: boolean;
  positions: UserPosition[];
  orders: UserOrder[];
  tradeHistory: UserTrade[];
  setUser: (u: AppUser | null) => void;
  setInitialized: (v: boolean) => void;
  setTradeHistory: (trades: UserTrade[]) => void;
  setPositions: (positions: UserPosition[]) => void;
  setOrders: (orders: UserOrder[]) => void;
  setBalance: (balance: number) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateBalance: (newBalance: number) => Promise<void>;
  addPosition: (position: UserPosition) => Promise<void>;
  addOrder: (order: UserOrder) => Promise<void>;
  addTradeHistory: (trade: UserTrade) => Promise<void>;
  closePosition: (positionId: string) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  loadUserData: (uid: string) => Promise<void>;
  clearUserData: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,
  loading: false,
  positions: [],
  orders: [],
  tradeHistory: [],

  setUser: (u) => set({ user: u }),
  setInitialized: (v) => set({ initialized: v }),
  
  setTradeHistory: (trades) => set({ tradeHistory: trades }),
  
  setPositions: (positions) => set({ positions }),
  
  setOrders: (orders) => set({ orders }),
  
  setBalance: (balance) => set((state) => ({ 
    user: state.user ? { ...state.user, balance } : null 
  })),

  login: async (email, password) => {
    set({ loading: true });
    try {
      await fbLogin(email, password);
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password, displayName) => {
    set({ loading: true });
    try {
      await fbRegister(email, password, displayName);
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    const u = get().user;
    await fbLogout(u?.uid, u?.email);
    set({ user: null, positions: [], orders: [], tradeHistory: [] });
  },

  resetPassword: async (email) => {
    await fbResetPassword(email);
  },

  updateBalance: async (newBalance: number) => {
    const user = get().user;
    if (!user) return;
    
    try {
      await updateUserBalance(user.uid, newBalance);
      set({ user: { ...user, balance: newBalance } });
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  },

  addPosition: async (position) => {
    const user = get().user;
    if (!user) return;
    await saveUserPosition(user.uid, position);
    set((state) => ({
      positions: [position, ...state.positions]
    }));
  },

  addOrder: async (order) => {
    const user = get().user;
    if (!user) return;
    await saveUserOrder(user.uid, order);
    set((state) => ({
      orders: [order, ...state.orders]
    }));
  },

  addTradeHistory: async (trade) => {
    const user = get().user;
    if (!user) return;
    await saveUserTrade(user.uid, trade);
    set((state) => ({
      tradeHistory: [trade, ...state.tradeHistory]
    }));
  },

  closePosition: async (positionId) => {
    const user = get().user;
    if (!user) return;
    await updatePositionStatus(user.uid, positionId, 'CLOSED');
    set((state) => ({
      positions: state.positions.map(p =>
        p.id === positionId ? { ...p, status: 'CLOSED' } : p
      )
    }));
  },

  cancelOrder: async (orderId) => {
    const user = get().user;
    if (!user) return;
    await updateOrderStatus(user.uid, orderId, 'CANCELLED');
    set((state) => ({
      orders: state.orders.map(o =>
        o.id === orderId ? { ...o, status: 'CANCELLED' } : o
      )
    }));
  },

  loadUserData: async (uid) => {
    const [positions, orders, tradeHistory] = await Promise.all([
      loadUserPositions(uid),
      loadUserOrders(uid),
      loadUserTrades(uid)
    ]);
    set({ positions, orders, tradeHistory });
  },

  clearUserData: () => {
    set({ positions: [], orders: [], tradeHistory: [] });
  },
}));