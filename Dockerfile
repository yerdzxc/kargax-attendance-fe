# ---- Build Stage ----
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

# ---- Production Stage ----
FROM oven/bun:1
WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/package.json ./

EXPOSE 3000

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["bun", "build/index.js"]
