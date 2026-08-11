# Firebase Setup — ApexTrade (auth + admin activity)

The Next.js app now uses **Firebase Authentication + Firestore** as the single
source of truth for users, roles, balances, and login activity. No Docker /
Postgres / NestJS is needed for auth or the admin dashboard.

> The web `apiKey` in `apps/web/src/components/firebase.js` is **not secret** —
> it only identifies the project. Real security comes from `firestore.rules`.

## One-time console setup (you must do this)

In the [Firebase console](https://console.firebase.google.com/project/brighterdays-68342):

1. **Authentication → Sign-in method →** enable **Email/Password**.
2. **Firestore Database →** create a database (Production mode is fine — we deploy rules below).
3. **Deploy the security rules** (`firestore.rules` in the repo root). Either:
   - **Console:** Firestore → Rules → paste the contents of `firestore.rules` → Publish, **or**
   - **CLI:**
     ```bash
     npm i -g firebase-tools
     firebase login
     firebase use brighterdays-68342
     firebase deploy --only firestore:rules
     ```

## Create the super admin

1. Run the app and go to **/register**.
2. Sign up with **`admin@apextrade.local`** and any password.
   - The code + rules automatically assign this email the **`super_admin`** role
     and a Firestore doc in the `users` collection.
3. Every other sign-up becomes a normal **`user`** with a **$0 balance**.

## What you get

- **Auth:** register, login, logout, password reset, session persistence (Firebase).
- **Firestore `users/{uid}`:** `displayName, email, role, balance (0), status, online, createdAt, lastLoginAt, lastActivity, ipAddress, device`.
- **Firestore `activity/{id}`:** every `register | login | logout | failed_login` with
  timestamp, username, email, IP (best-effort), device, and status.
- **Admin dashboard (`/admin`, admins only):**
  - **Overview** — totals, online-now, logins/failed today.
  - **User Management** — live list; edit any user's name/role/status/**balance**;
    one-click **+$1,000 / +$10,000** funding. Changes appear on the user's
    dashboard **in real time** (Firestore `onSnapshot`, no refresh).
  - **Recent User Activity** — live feed with online/offline dots and a
    **"N new" badge** for logins since you last opened the tab.

## Run

```bash
npm run dev -w apps/web      # Next.js only (Firebase is the backend)
```

Open http://localhost:3000 . (The markets ticker / trade order placement still
use the optional NestJS market service; auth + admin + dashboard are 100% Firebase.)

## Security notes / honest caveats

- Rules enforce: users can't self-assign roles, can't change their own balance,
  and start at **$0** (only an admin can fund them).
- `failed_login` events are writable pre-auth so unknown-email attempts are
  captured. For production, route those through a Cloud Function to prevent
  spam writes.
- Online presence uses a 20s heartbeat + 60s staleness window (Firestore has no
  native disconnect signal like Realtime DB).
