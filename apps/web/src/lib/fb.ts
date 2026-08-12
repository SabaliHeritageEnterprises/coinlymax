'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User as FbUser,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc, query, orderBy, where, limit as qlimit,
  onSnapshot, serverTimestamp, increment, Timestamp, getDocs,
} from 'firebase/firestore';
import { auth, db } from '@/components/firebase';

/** The single super-admin, designated by email (bootstrapped in code + rules). */
export const SUPER_ADMIN_EMAIL = 'admin@coinlymax.com';

export type Role = 'user' | 'admin' | 'super_admin';
export const isAdmin = (role?: Role | string) => role === 'admin' || role === 'super_admin';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  balance: number;
  status: 'active' | 'suspended';
  online: boolean;
  createdAt?: Timestamp;
  lastLoginAt?: Timestamp;
  lastActivity?: Timestamp;
  ipAddress?: string;
  device?: string;
  customProfitPercentage?: number; // ✅ NEW: per‑user override
}

export type ActivityType = 'register' | 'login' | 'logout' | 'failed_login';

// ── environment helpers ─────────────────────────────────────────
function deviceInfo(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const browser =
    /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' :
    /Safari/.test(ua) ? 'Safari' : 'Browser';
  const os =
    /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

let cachedIp: string | undefined;
async function clientIp(): Promise<string | undefined> {
  if (cachedIp) return cachedIp;
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    cachedIp = (await r.json()).ip;
  } catch {
    cachedIp = undefined;
  }
  return cachedIp;
}

// ── activity log ──────────────────────────────────────────────
export async function recordActivity(
  type: ActivityType,
  data: { uid?: string | null; email: string; username?: string | null; status?: 'success' | 'failed' },
) {
  try {
    await addDoc(collection(db, 'activity'), {
      type,
      status: data.status ?? (type === 'failed_login' ? 'failed' : 'success'),
      uid: data.uid ?? null,
      email: data.email,
      username: data.username ?? null,
      ipAddress: (await clientIp()) ?? null,
      device: deviceInfo(),
      timestamp: serverTimestamp(),
    });
  } catch {
    /* auditing must not break auth */
  }
}

// ── user profile docs ──────────────────────────────────────────
export async function ensureUserDoc(fb: FbUser, displayName?: string): Promise<void> {
  const ref = doc(db, 'users', fb.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const isSuper = fb.email === SUPER_ADMIN_EMAIL;
    await setDoc(ref, {
      uid: fb.uid,
      email: fb.email,
      displayName: displayName ?? fb.displayName ?? (fb.email?.split('@')[0] ?? 'Trader'),
      role: isSuper ? 'super_admin' : 'user',
      balance: 0,
      status: 'active',
      online: true,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
      ipAddress: (await clientIp()) ?? null,
      device: deviceInfo(),
      // customProfitPercentage is intentionally omitted – defaults to undefined
    });
  }
}

export async function getUserDoc(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as AppUser) : null;
}

// ── auth flows ──────────────────────────────────────────────────
export async function fbRegister(email: string, password: string, displayName?: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  await ensureUserDoc(cred.user, displayName);
  await recordActivity('register', { uid: cred.user.uid, email, username: displayName });
  return cred.user;
}

export async function fbLogin(email: string, password: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(cred.user);
    await markOnline(cred.user.uid, true);
    await recordActivity('login', { uid: cred.user.uid, email });
    return cred.user;
  } catch (e: any) {
    await recordActivity('failed_login', { email, status: 'failed' });
    throw e;
  }
}

export async function fbLogout(uid?: string, email?: string) {
  if (uid) {
    await markOnline(uid, false).catch(() => {});
    await recordActivity('logout', { uid, email: email ?? '' });
  }
  await signOut(auth);
}

export async function fbResetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

// ── presence ────────────────────────────────────────────────────
export async function markOnline(uid: string, online: boolean) {
  try {
    await updateDoc(doc(db, 'users', uid), { online, lastActivity: serverTimestamp() });
  } catch {
    /* ignore */
  }
}

export async function heartbeat(uid: string) {
  try {
    await updateDoc(doc(db, 'users', uid), { lastActivity: serverTimestamp() });
  } catch {
    /* ignore */
  }
}

/** A user is "online" if flagged online AND active within the last 60s. */
export function computeOnline(u: { online?: boolean; lastActivity?: Timestamp }): boolean {
  if (!u.online) return false;
  const ms = u.lastActivity?.toMillis?.() ?? 0;
  return Date.now() - ms < 60_000;
}

// ── admin actions ──────────────────────────────────────────────
export async function adminUpdateUser(uid: string, data: Partial<AppUser>) {
  await updateDoc(doc(db, 'users', uid), data as Record<string, unknown>);
}
export async function adminAdjustBalance(uid: string, delta: number) {
  await updateDoc(doc(db, 'users', uid), { balance: increment(delta) });
}

// ── realtime listeners ──────────────────────────────────────────
export function listenUsers(cb: (users: AppUser[]) => void) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as AppUser)), () => cb([]));
}

export function listenActivity(cb: (events: any[]) => void, max = 100) {
  const q = query(collection(db, 'activity'), orderBy('timestamp', 'desc'), qlimit(max));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export function listenUserDoc(uid: string, cb: (u: AppUser | null) => void) {
  return onSnapshot(doc(db, 'users', uid), (snap) => cb(snap.exists() ? (snap.data() as AppUser) : null), () => cb(null));
}

export function updateDisplayName(uid: string, displayName: string) {
  return updateDoc(doc(db, 'users', uid), { displayName });
}

/** A user's own activity (scoped query — sorted client-side to avoid a composite index). */
export function listenUserActivity(uid: string, cb: (events: any[]) => void) {
  const q = query(collection(db, 'activity'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      items.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
      cb(items.slice(0, 50));
    },
    () => cb([]),
  );
}

// ── demo trading: update user balance ──────────────────────────
export async function updateUserBalance(uid: string, newBalance: number) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { balance: newBalance });
    console.log(`✅ Demo trading: Balance updated for ${uid}: $${newBalance.toFixed(2)}`);
  } catch (error) {
    console.error('Failed to update balance:', error);
    throw error;
  }
}

// ── user trades storage ────────────────────────────────────────
export interface UserTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: number;
  quantity: number;
  total: number;
  timestamp: string;
  status: string;
  pnl: number;
  percentageGain: number;
}

export interface UserPosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  quantity: number;
  currentPrice: number;
  pnl: number;
  openTime: string;
  status: 'OPEN' | 'CLOSED';
}

export interface UserOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: number;
  quantity: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: string;
}

// ✅ FIXED: Save trade to user's subcollection with document ID
export async function saveUserTrade(uid: string, trade: UserTrade) {
  try {
    const tradeRef = doc(db, 'users', uid, 'trades', trade.id);
    await setDoc(tradeRef, trade);
    console.log(`✅ Trade saved for user ${uid}:`, trade.id);
    return trade.id;
  } catch (error) {
    console.error('❌ Failed to save trade:', error);
    throw error;
  }
}

// ✅ FIXED: Save position to user's subcollection with document ID
export async function saveUserPosition(uid: string, position: UserPosition) {
  try {
    const positionRef = doc(db, 'users', uid, 'positions', position.id);
    await setDoc(positionRef, position);
    console.log(`✅ Position saved for user ${uid}:`, position.id);
    return position.id;
  } catch (error) {
    console.error('❌ Failed to save position:', error);
    throw error;
  }
}

// ✅ FIXED: Save order to user's subcollection with document ID
export async function saveUserOrder(uid: string, order: UserOrder) {
  try {
    const orderRef = doc(db, 'users', uid, 'orders', order.id);
    await setDoc(orderRef, order);
    console.log(`✅ Order saved for user ${uid}:`, order.id);
    return order.id;
  } catch (error) {
    console.error('❌ Failed to save order:', error);
    throw error;
  }
}

// Load user's trades from Firestore
export async function loadUserTrades(uid: string): Promise<UserTrade[]> {
  try {
    const tradesRef = collection(db, 'users', uid, 'trades');
    const snapshot = await getDocs(tradesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTrade));
  } catch (error) {
    console.error('Failed to load trades:', error);
    return [];
  }
}

// Load user's positions from Firestore
export async function loadUserPositions(uid: string): Promise<UserPosition[]> {
  try {
    const positionsRef = collection(db, 'users', uid, 'positions');
    const snapshot = await getDocs(positionsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserPosition));
  } catch (error) {
    console.error('Failed to load positions:', error);
    return [];
  }
}

// Load user's orders from Firestore
export async function loadUserOrders(uid: string): Promise<UserOrder[]> {
  try {
    const ordersRef = collection(db, 'users', uid, 'orders');
    const snapshot = await getDocs(ordersRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserOrder));
  } catch (error) {
    console.error('Failed to load orders:', error);
    return [];
  }
}

// Update position status
export async function updatePositionStatus(uid: string, positionId: string, status: 'OPEN' | 'CLOSED') {
  try {
    const positionRef = doc(db, 'users', uid, 'positions', positionId);
    await updateDoc(positionRef, { status });
  } catch (error) {
    console.error('Failed to update position:', error);
  }
}

// Update order status
export async function updateOrderStatus(uid: string, orderId: string, status: 'PENDING' | 'FILLED' | 'CANCELLED') {
  try {
    const orderRef = doc(db, 'users', uid, 'orders', orderId);
    await updateDoc(orderRef, { status });
  } catch (error) {
    console.error('Failed to update order:', error);
  }
}

// ── real-time listeners for user trading data ──────────────────
export function listenUserTrades(uid: string, cb: (trades: UserTrade[]) => void) {
  const tradesRef = collection(db, 'users', uid, 'trades');
  return onSnapshot(tradesRef, (snapshot) => {
    const trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTrade));
    cb(trades);
  });
}

export function listenUserPositions(uid: string, cb: (positions: UserPosition[]) => void) {
  const positionsRef = collection(db, 'users', uid, 'positions');
  return onSnapshot(positionsRef, (snapshot) => {
    const positions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserPosition));
    cb(positions);
  });
}

export function listenUserOrders(uid: string, cb: (orders: UserOrder[]) => void) {
  const ordersRef = collection(db, 'users', uid, 'orders');
  return onSnapshot(ordersRef, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserOrder));
    cb(orders);
  });
}

export function listenUserBalance(uid: string, cb: (balance: number) => void) {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      const balance = snapshot.data()?.balance || 0;
      cb(balance);
    }
  });
}

// ── settings: profit percentage ──────────────────────────────────

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC = 'trading';

/** Get the current profit percentage (default 15). */
export async function getProfitPercentage(): Promise<number> {
  try {
    const ref = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data().profitPercentage ?? 15;
    } else {
      await setDoc(ref, { profitPercentage: 15 });
      return 15;
    }
  } catch {
    return 15;
  }
}

/** Update the profit percentage (admin only). */
export async function updateProfitPercentage(value: number): Promise<void> {
  const ref = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
  await setDoc(ref, { profitPercentage: value }, { merge: true });
}

/** Listen to real‑time changes to the profit percentage. */
export function listenProfitPercentage(callback: (value: number) => void): () => void {
  const ref = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data().profitPercentage ?? 15);
    } else {
      callback(15);
    }
  }, (error) => {
    console.error('Error listening to profit percentage:', error);
    callback(15);
  });
}