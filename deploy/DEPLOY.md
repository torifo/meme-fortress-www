# VPS 簡易デプロイ手順（GHCR + Docker Compose）

> ビルドは GitHub Actions（`.github/workflows/build-image.yml`）が
> `ghcr.io/torifo/meme-fortress:latest` を生成する。VPS では pull して
> docker compose で起動するだけ。

**前提:**
- ホスト: `x162-43-88-107` (`meme-fortress-www.riumu.net`)
- パス: `/home/ubuntu/Web/meme-fortress`
- Docker + Docker Compose v2 + `docker login ghcr.io` 済み
- nginx 導入済み（既存サイトと共存）

---

## 1. リポジトリ取得

```bash
cd /home/ubuntu/Web
git clone https://github.com/torifo/meme-fortress-www.git meme-fortress
cd meme-fortress
```

リポジトリは `deploy/compose.yml` と `deploy/meme-fortress.service` のみを使用する。

## 2. systemd で起動

```bash
sudo cp /home/ubuntu/Web/meme-fortress/deploy/meme-fortress.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now meme-fortress
sudo systemctl status meme-fortress --no-pager
```

systemd が `docker compose pull && docker compose up -d` を実行する。

ログ:
```bash
docker logs -f meme-fortress
# or
sudo journalctl -u meme-fortress -f
```

ヘルスチェック:
```bash
curl -s http://127.0.0.1:8787/api/health
# {"ok":true,"meme_count":301}
```

## 3. nginx + Let's Encrypt

```bash
sudo cp /home/ubuntu/Web/meme-fortress/deploy/nginx-site.conf \
        /etc/nginx/sites-available/meme-fortress-www.riumu.net
sudo ln -s /etc/nginx/sites-available/meme-fortress-www.riumu.net \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d meme-fortress-www.riumu.net \
  --non-interactive --agree-tos -m akito.shoji@geniee.co.jp --redirect
```

`https://meme-fortress-www.riumu.net/` で開通。

## 4. 更新（再デプロイ）

main に push すると GitHub Actions が新しい `:latest` を push する。
VPS では:

```bash
sudo systemctl restart meme-fortress
# 内部で pull → up -d が走る
```

または手動:
```bash
cd /home/ubuntu/Web/meme-fortress/deploy
docker compose pull && docker compose up -d
```

## 5. ロールバック

```bash
cd /home/ubuntu/Web/meme-fortress/deploy
# compose.yml の image タグを sha 指定に差し替えて up
# 例: ghcr.io/torifo/meme-fortress:<前のSHA>
$EDITOR compose.yml
docker compose up -d
```

## 6. データ永続化

SQLite は名前付きボリューム `meme-fortress_data` に保存される。
バックアップ:
```bash
docker run --rm -v meme-fortress_data:/data -v $PWD:/backup debian:bookworm-slim \
  tar czf /backup/meme-fortress-data-$(date +%Y%m%d).tar.gz -C /data .
```

## 7. 次サーバーへの移行

1. 旧サーバーで上記バックアップを取得
2. 新サーバーで `docker volume create meme-fortress_data` してから tar 展開
3. DNS A レコードを新ホストへ
4. 同じ手順を新サーバーで実行
