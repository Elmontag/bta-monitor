# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Vite env vars are baked in at build time — pass via --build-arg in docker compose
ARG VITE_PRIVACY_MODE=false
ARG VITE_KOFI_URL=
ENV VITE_PRIVACY_MODE=$VITE_PRIVACY_MODE
ENV VITE_KOFI_URL=$VITE_KOFI_URL

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Custom nginx config — exposes /data/cache & /data/donations from a shared volume
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets
COPY --from=builder /app/dist /usr/share/nginx/html

# /data is mounted as a Docker volume shared with the cache-service
VOLUME ["/data"]

EXPOSE 80
