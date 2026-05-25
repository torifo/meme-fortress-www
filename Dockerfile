# syntax=docker/dockerfile:1.7

# ---- Frontend build ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend build ----
# edition2024 requires Rust >= 1.85; use latest stable.
FROM rust:slim-bookworm AS backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY backend ./backend
COPY src-tauri ./src-tauri
RUN cargo build --release -p meme-fortress-backend

# ---- Runtime ----
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=backend  /app/target/release/meme-fortress-backend /app/backend/meme-fortress-backend
COPY --from=frontend /app/frontend/dist                         /app/frontend/dist
COPY docs/memes_seed.json                                       /app/docs/memes_seed.json

ENV PORT=8787
ENV RUST_LOG=info
EXPOSE 8787
VOLUME ["/app/data"]

# CARGO_MANIFEST_DIR resolves to /app/backend at compile time,
# workspace_path joins ".." -> /app, so docs/ data/ frontend/dist sit under /app.
CMD ["/app/backend/meme-fortress-backend"]
