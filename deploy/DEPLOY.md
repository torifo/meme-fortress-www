# VPS 簡易デプロイ手順（GHCR + nginx-proxy）

> ビルドは GitHub Actions（`.github/workflows/build-image.yml`）が
> `ghcr.io/torifo/meme-fortress:latest` を生成する。VPS では既存の
> `global-nginx-proxy` + `acme-companion` 構成に乗せるだけ。
> `VIRTUAL_HOST` / `LETSENCRYPT_HOST` を環境変数で渡せば HTTPS 含め自動。

**前提:**
- ホスト: `x162-43-88-107` (`meme-fortress-www.riumu.net`)
- パス: `/home/ubuntu/Web/meme-fortress`
- 既存の `global-nginx-proxy` (`nginxproxy/nginx-proxy`) と
  `global-letsencrypt` (`nginxproxy/acme-companion`) が稼働中
- `global-proxy-network` という external ネットワークが存在
- `docker login ghcr.io` 済み

---

## 1. リポジトリ取得 / 更新

```bash
cd /home/ubuntu/Web
git clone https://github.com/torifo/meme-fortress-www.git meme-fortress  # 初回のみ
cd meme-fortress
git pull
```

## 2. systemd で起動

```bash
sudo cp /home/ubuntu/Web/meme-fortress/deploy/meme-fortress.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now meme-fortress
sudo systemctl status meme-fortress --no-pager
```

systemd が `docker compose pull && docker compose up -d` を実行する。
コンテナは `global-proxy-network` に参加し、nginx-proxy が
`meme-fortress-www.riumu.net` 宛トラフィックをコンテナの 8787 に振る。
acme-companion が初回起動時に Let's Encrypt 証明書を取得する。

ログ:
```bash
docker logs -f meme-fortress
sudo journalctl -u meme-fortress -f
```

ヘルスチェック（コンテナ内ポートに直接）:
```bash
docker exec meme-fortress wget -qO- http://127.0.0.1:8787/api/health
```

外部から（証明書発行後）:
```bash
curl -sf https://meme-fortress-www.riumu.net/api/health
```

## 3. 更新（再デプロイ）

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

## 4. ロールバック

```bash
cd /home/ubuntu/Web/meme-fortress/deploy
# compose.yml の image タグを sha 指定に差し替えて up
# 例: ghcr.io/torifo/meme-fortress:<前のSHA>
$EDITOR compose.yml
docker compose up -d
```

## 5. データ永続化

SQLite は名前付きボリューム `deploy_data` に保存される。バックアップ:
```bash
docker run --rm -v deploy_data:/data -v $PWD:/backup debian:bookworm-slim \
  tar czf /backup/meme-fortress-data-$(date +%Y%m%d).tar.gz -C /data .
```

## 6. 次サーバーへの移行

1. 旧サーバーで上記バックアップを取得
2. 新サーバーで `global-nginx-proxy` 系を立ち上げ、同様に compose を起動
3. ボリューム `deploy_data` に旧データを展開
4. DNS A レコードを新ホストへ
