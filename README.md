# ApexTrade

An **enterprise-grade crypto & forex trading platform** (simulation MVP) inspired by Binance — built as a scalable foundation that can later grow into a licensed exchange.

> ⚠️ **Simulation only.** No payments, deposits, withdrawals, or real-money execution. Every account starts with **$100,000 in paper capital**. This is an MVP foundation for a future business model.

---

## ✨ Features

| Area | What's included |
|------|-----------------|
| **Auth & Security** | Email/password signup, email verification, login, password reset, **TOTP 2FA** with recovery codes, JWT access + rotating refresh tokens (httpOnly cookie), device/session management, account activity logs, RBAC (USER / ADMIN / SUPER_ADMIN) |
| **Markets** | Live price feed over WebSockets, crypto + forex pairs, top gainers/losers, trending, search, favorites & named watchlists with saved layouts |
| **Charts** | TradingView Advanced Charts (candlesticks, RSI/MACD/EMA/SMA, drawing tools, multi-timeframe, fullscreen) |
| **Trading terminal** | Pair selector, large chart, order ticket (market/limit/stop-limit, SL/TP), open positions, open orders, trade history — **simulated execution** against the live feed |
| **Dashboard** | Portfolio equity & unrealized PnL, security center (2FA, password), device manager, activity feed, settings, API-keys placeholder |
| **Admin console** | Analytics, user management (suspend/activate, role changes), market-pair management, audit + activity logs, broadcast notifications |
| **Security hardening** | Helmet, CORS w/ credentials, global DTO validation & sanitization, Redis-backed rate limiting, argon2 password hashing, SQL-injection-safe Prisma, XSS-safer in-memory access tokens |

---

## 🏗️ Architecture

```
apex-trade/
├─ apps/
│  ├─ api/                  # NestJS backend (REST + WebSocket)
│  │  ├─ prisma/            # schema.prisma + seed
│  │  └─ src/
│  │     ├─ common/         # guards, decorators, enums (RBAC)
│  │     ├─ config/         # typed config + env validation
│  │     ├─ prisma/ redis/ mail/   # infrastructure modules
│  │     └─ modules/
│  │        ├─ auth/        # JWT, refresh rotation, 2FA, reset, verify
│  │        ├─ users/       # profile, settings, portfolio, password
│  │        ├─ sessions/    # device management
│  │        ├─ activity-log/
│  │        ├─ market/      # pairs, candles, WS gateway, price-feed engine
│  │        ├─ trades/      # simulation matching engine
│  │        ├─ watchlist/   # favorites + watchlists
│  │        ├─ notifications/
│  │        └─ admin/       # analytics, user/market mgmt, logs, broadcast
│  └─ web/                  # Next.js 15 (App Router) frontend
│     └─ src/
│        ├─ app/            # landing, markets, trade/[symbol], auth, dashboard, admin
│        ├─ components/     # navbar, footer, chart, order panel, tables…
│        ├─ store/          # Zustand (auth, market)
│        └─ lib/            # api client, ws client, types, utils
├─ docker-compose.yml       # Postgres + Redis + dockerized API
├─ .env.example
└─ DEPLOYMENT.md
```

**Tech:** Next.js 15 · TypeScript · Tailwind · Framer Motion · Zustand · socket.io-client · NestJS · Prisma · PostgreSQL · Redis · JWT · argon2 · otplib.

---

## 🚀 Quick start

### Prerequisites
- **Node.js 20+** and npm
- **Docker Desktop** (for Postgres + Redis) — or local Postgres/Redis instances

### 1. Clone & install
```bash
npm install            # installs both workspaces
```

### 2. Configure environment
```bash
# Root (used by docker-compose)
cp .env.example .env

# Backend
cp apps/api/.env.example apps/api/.env

# Frontend
cp apps/web/.env.example apps/web/.env.local
```
Generate strong JWT secrets and paste them into `apps/api/.env`:
```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
```

### 3. Start infrastructure (Postgres + Redis)
```bash
docker compose up -d postgres redis
```

### 4. Migrate & seed the database
```bash
npm run db:migrate     # creates tables
npm run db:seed        # super-admin + crypto/forex pairs
```
Seed creates a super admin → `admin@apextrade.local` / `Admin123!Change` (change in `.env`).

### 5. Run the apps
```bash
npm run dev            # runs API (:4000) and web (:3000) together
```
- Frontend → http://localhost:3000
- API → http://localhost:4000/api/v1
- Live market WebSocket → `ws://localhost:4000/market`

> **No SMTP in dev?** Verification/reset emails are printed to the **API console** — copy the link from there.

---

## 🐳 Full Docker (API + infra)
```bash
docker compose up -d --build
```
Runs Postgres, Redis, and the dockerized API (auto-runs `prisma migrate deploy`). Run the seed once against it, then start the frontend with `npm run dev -w apps/web`.

---

## 🔌 Going live later (out of scope for the MVP)
The codebase is structured so you can graduate to a real exchange without rewrites:
1. Replace `PriceFeedService.tick()` with a connector to a licensed crypto exchange + FX provider (the WebSocket gateway + Redis cache contracts stay identical).
2. Swap the TradingView embed for the self-hosted **charting_library** pointed at the existing `/market/:symbol/candles` datafeed.
3. Add a custody/ledger module, KYC/AML, and a real matching engine alongside the simulation engine.
4. Layer payment rails behind feature flags + regulatory compliance.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for Vercel + Docker production deployment.

---

## 📡 API surface (selected)
```
POST   /auth/register | /auth/login | /auth/refresh | /auth/logout
POST   /auth/verify-email | /auth/forgot-password | /auth/reset-password
POST   /auth/2fa/init | /auth/2fa/enable | /auth/2fa/disable
GET    /users/me | PATCH /users/me | GET /users/me/portfolio | /me/activity
GET    /sessions | DELETE /sessions/:id | DELETE /sessions/others
GET    /market/pairs | /market/movers | /market/pairs/:symbol/candles
POST   /trades/orders | GET /trades/orders | /trades/positions
GET    /watchlist | /watchlist/favorites | POST /watchlist/favorites/:symbol
GET    /notifications | POST /notifications/read-all
GET    /admin/analytics | /admin/users | PATCH /admin/users/:id/status
POST   /admin/pairs | /admin/notifications/broadcast
```

## 📜 License & disclaimer
For demonstration & educational use only. Not financial advice. Not a licensed exchange.
