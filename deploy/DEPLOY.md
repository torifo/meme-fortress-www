# VPS 簡易デプロイ手順

> 一時運用前提。画像導入と DB 変更で別サーバーに移すので、ここでは
> 「git clone → cargo build → systemd → nginx + certbot」の最短経路だけ。

**前提:**
- ホスト: `x162-43-88-107` (`meme-fortress-www.riumu.net` の A レコードが向いている)
- パス: `/home/ubuntu/Web/meme-fortress`
- OS: Ubuntu（root か sudo 可能ユーザー）

---

## 1. 必要パッケージのインストール

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev curl git nginx
# Rust（rustup）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
# Node.js 20（NodeSource）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. リポジトリ取得

```bash
sudo mkdir -p /home/ubuntu/Web
sudo chown ubuntu:ubuntu /home/ubuntu/Web
cd /home/ubuntu/Web
git clone git@github.com:torifo/meme-fortress-www.git meme-fortress
cd meme-fortress
```

（SSH 鍵が無ければ `https://github.com/...` でも可）

## 3. ビルド

```bash
cd /home/ubuntu/Web/meme-fortress
# フロントエンド（dist/ が backend のフォールバック配信先）
cd frontend && npm install && npm run build && cd ..
# バックエンド（release）
cargo build --release -p meme-fortress-backend
```

> **注意:** バックエンドは `env!("CARGO_MANIFEST_DIR")` を元に
> `docs/memes_seed.json`、`data/`、`frontend/dist` を解決するため、
> **必ず VPS 上でビルドする**こと。ローカルでビルドしたバイナリを
> scp してもパス解決が壊れる。

## 4. データディレクトリ

`data/meme-fortress.sqlite` は初回起動時に自動生成される。
起動時に Google Sheets から vote_logs を自動同期する（commit `7085df8`）。

任意で `SHEET_VOTES_CSV_URL` 環境変数で別の Sheets を指す事も可能。

## 5. systemd 起動

```bash
sudo cp /home/ubuntu/Web/meme-fortress/deploy/meme-fortress.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now meme-fortress
sudo systemctl status meme-fortress
```

ログ:
```bash
sudo journalctl -u meme-fortress -f
```

確認:
```bash
curl -s http://127.0.0.1:8787/api/health
# {"ok":true,"meme_count":301}
```

## 6. nginx + Let's Encrypt

```bash
sudo cp /home/ubuntu/Web/meme-fortress/deploy/nginx-site.conf \
        /etc/nginx/sites-available/meme-fortress-www.riumu.net
sudo ln -s /etc/nginx/sites-available/meme-fortress-www.riumu.net \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 80 番が通った事を確認後、certbot で HTTPS
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d meme-fortress-www.riumu.net \
  --non-interactive --agree-tos -m akito.shoji@geniee.co.jp \
  --redirect
```

完了後 `https://meme-fortress-www.riumu.net/` で開ける。

## 7. 更新（再デプロイ）

```bash
cd /home/ubuntu/Web/meme-fortress
git pull
cd frontend && npm install && npm run build && cd ..
cargo build --release -p meme-fortress-backend
sudo systemctl restart meme-fortress
```

## 8. ロールバック

systemd を止めて `git checkout <前のSHA>` → 再ビルド → 再起動。

```bash
sudo systemctl stop meme-fortress
git checkout <SHA>
cargo build --release -p meme-fortress-backend
sudo systemctl start meme-fortress
```

## 移行時メモ（次サーバーへ）

- `data/meme-fortress.sqlite` を tar で持っていけば voted_logs と memes が両方移る
- 画像対応 + DB を変える際は `docs/tech.md` のフェーズ 2（SurrealDB + S3/R2）へ
- ドメインは A レコードを新サーバーに向けるだけ
