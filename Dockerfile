# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN npm install

COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/package.json ./

EXPOSE 3000

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", "build/index.js"]
