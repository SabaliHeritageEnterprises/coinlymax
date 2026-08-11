# Deployment Guide

ApexTrade is split into two deployables:
- **Frontend** (`apps/web`) → optimized for **Vercel**
- **Backend** (`apps/api`) → **Dockerized**, deploy to any container host (Render, Railway, Fly.io, AWS ECS, GCP Cloud Run, DigitalOcean App Platform…)

Managed **PostgreSQL** and **Redis** are required.

---

## 1. Provision infrastructure
| Service | Suggested providers |
|---------|---------------------|
| PostgreSQL 16 | Neon, Supabase, RDS, Railway |
| Redis 7 | Upstash, Redis Cloud, ElastiCache |

Collect the connection strings:
- `DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public&sslmode=require`
- `REDIS_HOST`, `REDIS_PORT` (or a single `REDIS_URL`)

---

## 2. Deploy the backend (Docker)

### Build & run
```bash
cd apps/api
docker build -t apex-api .
docker run -p 4000:4000 --env-file .env.production apex-api
```
The image runs `prisma migrate deploy` on boot, then starts the server.

### Required production env (`apps/api/.env.production`)
```env
NODE_ENV=production
API_PORT=4000
CORS_ORIGIN=https://your-frontend.vercel.app
DATABASE_URL=postgresql://...
REDIS_HOST=...
REDIS_PORT=6379
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
TOTP_ISSUER=ApexTrade
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="ApexTrade <no-reply@yourdomain.com>"
```

### First-time seed (run once)
```bash
docker run --rm --env-file .env.production apex-api npm run prisma:seed
```

### Notes for production
- Put the API behind HTTPS (the refresh cookie uses `secure` in production).
- If the frontend is on a different domain, set `SameSite=None; Secure` on the cookie (adjust `auth.controller.ts`) and ensure CORS `credentials: true` + exact `CORS_ORIGIN`.
- Enable sticky sessions / WebSocket support on the load balancer for socket.io. For horizontal scaling, add the socket.io Redis adapter (Redis is already provisioned).
- Run `prisma migrate deploy` (not `migrate dev`) in production.

---

## 3. Deploy the frontend (Vercel)
1. Import the repo into Vercel and set the **Root Directory** to `apps/web`.
2. Framework preset: **Next.js** (auto-detected). Build: `next build`.
3. Environment variables:
   ```env
   NEXT_PUBLIC_API_URL=https://your-api-domain.com/api/v1
   NEXT_PUBLIC_WS_URL=https://your-api-domain.com
   NEXT_PUBLIC_SITE_NAME=ApexTrade
   ```
4. Deploy. Update the backend `CORS_ORIGIN` to the resulting Vercel URL and redeploy the API.

---

## 4. Post-deploy checklist
- [ ] `GET /api/v1/market/pairs` returns seeded pairs
- [ ] WebSocket connects (landing-page ticker scrolls)
- [ ] Register → verification email (or SMTP) works
- [ ] Login + 2FA enrolment works
- [ ] Super-admin can reach `/admin`
- [ ] Rate limiting active (rapid login attempts get 429)
- [ ] HTTPS enforced; refresh cookie set with `Secure`

---

## 5. Scaling guidance
- **API**: stateless except for the price-feed singleton — run the feed in a single replica (or extract it into a dedicated worker) and scale the HTTP/WS replicas behind the socket.io Redis adapter.
- **DB**: add read replicas; the schema is already indexed on hot paths (`users`, `sessions`, `trades`, `activity_logs`).
- **Cache**: Redis already backs rate limiting + latest tickers; extend it for market snapshots and session lookups.
- **Observability**: add a logger transport (pino), error tracking (Sentry), and metrics (Prometheus) — wire into `main.ts` and a global exception filter.
