# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and generate Prisma client + build
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only production deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Artifacts from build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000

# Run pending migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
