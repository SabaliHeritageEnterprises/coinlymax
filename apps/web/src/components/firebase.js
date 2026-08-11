// Firebase initialization for ApexTrade (client SDK).
// The web apiKey is NOT a secret — it identifies the project. Real security is
// enforced by Firestore Security Rules (see firestore.rules) + Firebase Auth.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyClhEhgA_qtghTrMV8MIrR3hIpUf7uXtZE',
  authDomain: 'brighterdays-68342.firebaseapp.com',
  projectId: 'brighterdays-68342',
  storageBucket: 'brighterdays-68342.firebasestorage.app',
  messagingSenderId: '321066533168',
  appId: '1:321066533168:web:49c7c9c4fcfd67fdb148f5',
  measurementId: 'G-Y43ZXNX8VD',
};

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
