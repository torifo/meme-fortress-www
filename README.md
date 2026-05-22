# MEME FORTRESS

🚧 **開発中（Under Development）** 🚧

ネットミームを『要塞チックに演出付き』体験を提供する、エンタメ寄りのミーム図書館アプリ。

## 構成

| パート | 状態 | 場所 |
|--------|------|------|
| **スワイプ図書館（GitHub Pages）** | 公開中 | `docs/` → https://torifo.github.io/meme-fortress-www/ |
| **本命アプリ（バックエンド付き）** | 未着手 | 本リポジトリで独自ドメインで公開予定 |
| **デザインプロトタイプ** | ローカル管理 | `design/`（`.gitignore`） |

## このリポジトリで管理しているもの

GitHub Pages から配信する静的サイトのみ：

- `docs/index.html` — Tinder型スワイプUI（収集 / スキップ）
- `docs/memes_seed.json` — ミームデータシード（189件、随時追加）
- `docs/spec.md` — プロジェクト全体の仕様書
- `docs/tech.md` — 技術スタック

`design/` 配下のFigma書き出し等はローカル専用。

## スワイプ図書館の仕組み

- 左スワイプ＝**SKIP**、右スワイプ＝**COLLECT**（キーボード ← / → も対応）
- 結果は LocalStorage に永続化、`■ 中断`ボタンで中断可能
- 各スワイプは Google Apps Script 経由で Google Sheets に投票として記録
- 集計データは将来「相対的な知名度ティア（王道 / 中堅 / マニアック）」を自動算出するためのバックエンドで使用予定

## 今後の予定

- [ ] バックエンド付きの本命アプリ（別リポジトリ）
- [ ] Sheets 集計から動的な popularity_tier 算出
- [ ] 「ガチャ」「銀はがし」「コレクション」3フェーズの実装（`docs/spec.md` 参照）

---

🚧 **Status: Under active development. Specs and data may change without notice.**
