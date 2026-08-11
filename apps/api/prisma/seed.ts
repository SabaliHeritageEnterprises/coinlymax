import { PrismaClient, MarketType, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Seed catalogue — symbols and starting reference prices.
const CRYPTO = [
  // USDT/USDT — stablecoin pair pinned at $1.00, listed first (trend:true keeps it ahead of BTC).
  { symbol: 'USDTUSDT', base: 'USDT', quote: 'USDT', price: 1.0, cap: 0, trend: true },
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', price: 67000, cap: 1_320_000_000_000, trend: true },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', price: 3500, cap: 420_000_000_000, trend: true },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', price: 165, cap: 75_000_000_000, trend: true },
  { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', price: 0.62, cap: 34_000_000_000, trend: false },
  { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', price: 0.16, cap: 23_000_000_000, trend: true },
  { symbol: 'ADAUSDT', base: 'ADA', quote: 'USDT', price: 0.45, cap: 16_000_000_000, trend: false },
  { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', price: 590, cap: 88_000_000_000, trend: false },
  { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', price: 36, cap: 14_000_000_000, trend: false },
  { symbol: 'MATICUSDT', base: 'MATIC', quote: 'USDT', price: 0.72, cap: 7_000_000_000, trend: false },
  { symbol: 'LINKUSDT', base: 'LINK', quote: 'USDT', price: 18, cap: 11_000_000_000, trend: false },
];

const FOREX = [
  { symbol: 'EURUSD', base: 'EUR', quote: 'USD', price: 1.085, prec: 5 },
  { symbol: 'GBPUSD', base: 'GBP', quote: 'USD', price: 1.27, prec: 5 },
  { symbol: 'USDJPY', base: 'USD', quote: 'JPY', price: 156.3, prec: 3 },
  { symbol: 'USDCAD', base: 'USD', quote: 'CAD', price: 1.365, prec: 5 },
  { symbol: 'USDCHF', base: 'USD', quote: 'CHF', price: 0.9, prec: 5 },
  { symbol: 'AUDUSD', base: 'AUD', quote: 'USD', price: 0.665, prec: 5 },
  { symbol: 'XAUUSD', base: 'XAU', quote: 'USD', price: 2330, prec: 2 },
  { symbol: 'XAGUSD', base: 'XAG', quote: 'USD', price: 30.5, prec: 3 },
];

async function main() {
  // ── Super admin ──────────────────────────────────────────────
  const email = process.env.SEED_SUPERADMIN_EMAIL ?? 'admin@apextrade.local';
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? 'Admin123!Change';
  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      displayName: 'Super Admin',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      settings: { create: {} },
    },
  });
  console.log(`✓ Super admin ready: ${email}`);

  // ── Crypto pairs ─────────────────────────────────────────────
  for (const [i, c] of CRYPTO.entries()) {
    await prisma.marketPair.upsert({
      where: { symbol: c.symbol },
      update: { lastPrice: c.price, marketCap: c.cap, isTrending: c.trend },
      create: {
        symbol: c.symbol,
        base: c.base,
        quote: c.quote,
        displayName: `${c.base}/${c.quote}`,
        type: MarketType.CRYPTO,
        lastPrice: c.price,
        marketCap: c.cap,
        isTrending: c.trend,
        pricePrecision: c.price < 1 ? 4 : 2,
        qtyPrecision: 6,
        sortOrder: i,
      },
    });
  }
  console.log(`✓ Seeded ${CRYPTO.length} crypto pairs`);

  // ── Forex pairs ──────────────────────────────────────────────
  for (const [i, f] of FOREX.entries()) {
    await prisma.marketPair.upsert({
      where: { symbol: f.symbol },
      update: { lastPrice: f.price },
      create: {
        symbol: f.symbol,
        base: f.base,
        quote: f.quote,
        displayName: `${f.base}/${f.quote}`,
        type: MarketType.FOREX,
        lastPrice: f.price,
        pricePrecision: f.prec,
        qtyPrecision: 2,
        sortOrder: 100 + i,
      },
    });
  }
  console.log(`✓ Seeded ${FOREX.length} forex pairs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
