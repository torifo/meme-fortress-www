# MEME FORTRESS / 電脳ミーム要塞

<!-- tech-stack:start (auto-generated) -->
<p align="center">
  <img src="https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
</p>
<!-- tech-stack:end -->

🚧 **開発中（Under Development）** 🚧

ネットミームを「要塞」テーマで派手に演出するエンタメ寄りミーム図書館アプリ。
昭和〜令和のミーム 301 件 + 約 1,200 件の投票履歴をベースに、スワイプ・スナッチ・コレクション・ランキングを提供する。

- 本番: https://meme-fortress-www.riumu.net
- API : https://api.meme-fortress.riumu.net/api/health

## 構成

```
meme-fortress/
├── frontend/        React + Vite + TypeScript の SPA（ブラウザ/Tauri 共通）
├── backend/         Rust + axum + SQLite の REST API
├── src-tauri/       Tauri 2 デスクトップシェル（同じ SPA を内包）
├── docs/            seed JSON、spec、tech ドキュメント
├── deploy/          compose.yml / systemd ユニット / 手順
├── Dockerfile       multi-stage で backend と frontend を別ターゲットで生成
└── .github/workflows/build-image.yml  GHCR への自動ビルド・push
```

## 技術スタック

| 層 | 採用 | 役割 |
|---|---|---|
| フロント | **React 18 / TypeScript / Vite** | スワイプUI、コレクション、ランキング画面 |
| バックエンド | **Rust 2024 / axum 0.8 / sqlx 0.8** | REST API、Sheets vote 自動同期 |
| DB | **SQLite**（フェーズ1） | `data/meme-fortress.sqlite`、名前付き volume で永続化 |
| デスクトップ | **Tauri 2** | 同じフロントをラップしたネイティブシェル |
| 配信 | **Docker + nginx-proxy + acme-companion** | GHCR からの自動 pull と TLS 自動取得 |
| CI | **GitHub Actions** | matrix で backend / frontend イメージを並列ビルド |

詳細は `docs/tech.md`。

## 機能（実装済み）

- **スナッチ**（爆速スクロールから捕獲）— 大砲バリアントの粒子＋集中線＋画面シェイク
- **スクラッチカード**（銀はがしポストカード）— canvas で削り、剥離率に応じてオープン
- **コレクション**（電脳ミーム大百科）— collect 数降順表示、時代別フィルター
- **ランキング**（人気ミーム）— collect 数 / 率 / 投票数でソート切替、上位3件メダル
- **投票ログ自動同期**— サーバー起動時に Google Sheets CSV を取り込み
- **ページ遷移演出**— タブ切替時に進行方向に応じた横もや
- **岩崩しエフェクト**— 二次ボタン押下時の瓦礫飛散＋重力落下
- **未見優先フィード**— 既見ミームを除外してフィードに流す（全部見た場合は全件にフォールバック）

## エンドポイント（バックエンド）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/health` | DB 接続確認、meme 件数 |
| GET | `/api/memes?exclude_seen=true&limit=120` | ランダムメム取得（未見フィルタ付き） |
| GET | `/api/collection` | collect 済みミーム（meme_id でグループ化、collect 数降順） |
| GET | `/api/ranking` | ミームごとの collect/skip/total 集計、collect 数 + total 順、最大200件 |
| POST | `/api/snatches` | スナッチ捕獲ログ作成（postcard_code 発行） |
| POST | `/api/reveals` | スクラッチ完了ログ作成 |
| POST | `/api/votes/sync` | Google Sheets CSV → `vote_logs` 同期（起動時にも自動実行） |

## 開発

```bash
# backend
cargo run -p meme-fortress-backend
# → http://localhost:8787

# frontend（別シェル）
cd frontend && npm install && npm run dev
# → http://localhost:5173 （API は /api/* を直接叩く）
```

`docs/memes_seed.json` を読み込んで `data/meme-fortress.sqlite` を生成。
`SHEET_VOTES_CSV_URL` 環境変数で同期元 CSV を差し替え可。

## デプロイ

main に push すると GitHub Actions が以下 2 イメージを GHCR に push する:

- `ghcr.io/torifo/meme-fortress-backend:latest`
- `ghcr.io/torifo/meme-fortress-frontend:latest`

VPS では `sudo systemctl restart meme-fortress` で `docker compose pull && up -d` が走る。
完全な手順は **[deploy/DEPLOY.md](deploy/DEPLOY.md)** 参照。

## データ

- `docs/memes_seed.json`: meme マスタ 301 件（ニコ動・アニメ・X・TikTok・映画・漫画・配信者等の幅広い時代）
- vote_logs: 約 1,200 件の collect/skip 履歴を Google Sheets から取り込み済
- 時代区分: フラッシュ倉庫時代 / ニコニコ動画時代前期・後期 / Twitter時代以前・爆発時代 / TikTok時代・以降

## ロードマップ

- [ ] 称号システム（collect 数に応じたバッジ）
- [ ] スナッチ・タイミング判定の本格実装
- [ ] 効果音（金属音 + 爆発音）
- [ ] マルチユーザー対応（リアルタイムランキング）
- [ ] **フェーズ2:** SurrealDB 移行と画像コンテンツ対応（自作サーバー移行のタイミングで）

実装計画は `docs/superpowers/plans/`、仕様詳細は `docs/spec.md`。

## ライセンス

未定（私的開発リポジトリ）。

---

🚧 **Status: Under active development. Specs and data may change without notice.**
