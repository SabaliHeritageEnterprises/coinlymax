# Builder stage
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y openssl

WORKDIR /app

# Copy API files
COPY apps/api/package*.json ./
COPY apps/api/prisma ./prisma/

# Change npm ci to npm install
RUN npm install --legacy-peer-deps
RUN npx prisma generate

# Copy source code
COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./
COPY apps/api/nest-cli.json ./

# Build
RUN npm run build

# Production stage
FROM node:22-slim

RUN apt-get update && apt-get install -y openssl

WORKDIR /app

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]