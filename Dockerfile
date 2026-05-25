# syntax=docker/dockerfile:1.7

# ===== Frontend build =====
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_BASE_URL=https://api.meme-fortress.riumu.net
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ===== Frontend runtime (nginx static) =====
FROM nginx:1.29-alpine AS frontend-runtime
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# ===== Backend build =====
# edition2024 requires Rust >= 1.85; use latest stable.
FROM rust:slim-bookworm AS backend-build
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY backend ./backend
COPY src-tauri ./src-tauri
RUN cargo build --release -p meme-fortress-backend

# ===== Backend runtime =====
FROM debian:bookworm-slim AS backend-runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=backend-build /app/target/release/meme-fortress-backend /app/backend/meme-fortress-backend
COPY docs/memes_seed.json                                            /app/docs/memes_seed.json

ENV PORT=8787
ENV RUST_LOG=info
EXPOSE 8787
VOLUME ["/app/data"]

# CARGO_MANIFEST_DIR resolves to /app/backend at compile time,
# workspace_path joins ".." -> /app, so docs/ and data/ sit under /app.
CMD ["/app/backend/meme-fortress-backend"]
