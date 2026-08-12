// Firebase initialization for CoinlyMax (client SDK).
// The web apiKey is NOT a secret — it identifies the project. Real security is
// enforced by Firestore Security Rules (see firestore.rules) + Firebase Auth.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBb-VOXVmCmWft_HBep_ZqYoBqYXMWsN_4',
  authDomain: 'coinlymax.firebaseapp.com',
  projectId: 'coinlymax',
  storageBucket: 'coinlymax.firebasestorage.app',
  messagingSenderId: '454807147603',
  appId: '1:454807147603:web:779d94093293ddb5ac62a6',
  measurementId: 'G-RK573LCNKL',
};

// ✅ ADDED: Console log to verify which Firebase project is loaded
console.log('🔥 Firebase projectId:', firebaseConfig.projectId);
console.log('🔥 Firebase apiKey:', firebaseConfig.apiKey);

// Avoid re-initializing during Next.js fast-refresh / SSR.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics only works in the browser; load it lazily and ignore failures.
export async function initAnalytics() {
  if (typeof window === 'undefined') return null;
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) return getAnalytics(app);
  } catch {
    /* analytics is optional */
  }
  return null;
}

export { app };