# 電脳ミーム要塞 大規模実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1200件のvote_logsデータを活用し、未見優先フィード・コレクション画面・ランキング画面を実装する

**Architecture:** バックエンド（Rust/axum）に新APIエンドポイントを追加し、フロントエンド（React/TypeScript）にページ遷移とコレクション・ランキング画面を追加する。TauriデスクトップアプリはバックエンドAPIと並行して同等コマンドを実装する。

**Tech Stack:** Rust 2024/axum 0.8/sqlx 0.8/SQLite, React 18/TypeScript/Vite, Tauri 2

---

## ワークツリー戦略

3並列ワークツリーで実装する。WB・WCはWAのマージを待たずモックデータで先行可能。

```
main
├── WA: feature/backend-apis        ← 新APIエンドポイント + 起動時sync
├── WB: feature/frontend-nav-col    ← ナビ + コレクション画面（mock→実API）
└── WC: feature/frontend-ranking    ← ランキング画面（mock→実API）
```

**ワークツリー作成コマンド（実装開始時に main で実行）:**
```bash
git worktree add ../meme-fortress-wa feature/backend-apis --orphan 2>/dev/null || \
  git worktree add ../meme-fortress-wa -b feature/backend-apis
git worktree add ../meme-fortress-wb -b feature/frontend-nav-col
git worktree add ../meme-fortress-wc -b feature/frontend-ranking
```

---

## ファイルマップ

### WA — backend-apis

| 操作 | ファイル | 内容 |
|------|----------|------|
| Modify | `backend/src/main.rs` | 新ルート3本・起動時vote sync・型追加 |
| Modify | `src-tauri/src/lib.rs` | 対応Tauriコマンド3本追加 |

### WB — frontend-nav-col

| 操作 | ファイル | 内容 |
|------|----------|------|
| Modify | `frontend/src/types.ts` | `CollectionMeme`, `RankingMeme`, `Page` 型追加 |
| Modify | `frontend/src/api.ts` | `fetchCollection()`, `fetchRanking()`, `fetchUnseenMemes()` 追加 |
| Create | `frontend/src/components/NavBar.tsx` | ページ切替ナビ |
| Create | `frontend/src/pages/CollectionPage.tsx` | コレクション一覧 |
| Modify | `frontend/src/App.tsx` | ページ状態管理・NavBar組込・未見フィードAPI切替 |

### WC — frontend-ranking

| 操作 | ファイル | 内容 |
|------|----------|------|
| Create | `frontend/src/pages/RankingPage.tsx` | ランキング一覧・era別集計 |

---

## Task WA-1: 起動時 vote 自動 sync（backend）

**Files:**
- Modify: `backend/src/main.rs`

- [ ] **Step 1: `main()` に起動sync追加**

`backend/src/main.rs` の `seed_memes(&db).await?;` の直後に追加:

```rust
// 起動時に Google Sheets の vote_logs を非同期で同期（失敗しても続行）
if let Err(err) = sync_votes_from_sheet(&db).await {
    tracing::warn!("startup vote sync failed (non-fatal): {err}");
}
```

- [ ] **Step 2: ビルド確認**

```bash
cargo build -p meme-fortress-backend 2>&1 | tail -5
```

Expected: `Compiling meme-fortress-backend` → `Finished`

- [ ] **Step 3: commit**

```bash
git add backend/src/main.rs
git commit -m "Auto-sync vote_logs from Sheets on backend startup"
```

---

## Task WA-2: 未見ミーム API（backend）

**Files:**
- Modify: `backend/src/main.rs`

- [ ] **Step 1: `MemeQuery` に `exclude_seen` フラグ追加**

`backend/src/main.rs` の `MemeQuery` を以下に置換:

```rust
#[derive(Debug, Deserialize)]
struct MemeQuery {
    limit: Option<i64>,
    exclude_seen: Option<bool>,
}
```

- [ ] **Step 2: `list_memes` ハンドラを分岐対応に変更**

`list_memes` 関数全体を以下に置換:

```rust
async fn list_memes(
    State(state): State<AppState>,
    Query(query): Query<MemeQuery>,
) -> Result<Json<Vec<Meme>>, AppError> {
    let limit = query.limit.unwrap_or(96).clamp(1, 500);
    let exclude_seen = query.exclude_seen.unwrap_or(false);

    let rows = if exclude_seen {
        sqlx::query(
            r#"
            SELECT m.* FROM memes m
            WHERE m.id NOT IN (SELECT DISTINCT meme_id FROM vote_logs)
            ORDER BY RANDOM()
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query("SELECT * FROM memes ORDER BY RANDOM() LIMIT ?")
            .bind(limit)
            .fetch_all(&state.db)
            .await?
    };

    Ok(Json(rows.into_iter().map(row_to_meme).collect()))
}
```

- [ ] **Step 3: ビルド確認**

```bash
cargo build -p meme-fortress-backend 2>&1 | tail -5
```

Expected: `Finished`

- [ ] **Step 4: 動作確認（サーバー起動中に別ターミナルで）**

```bash
cargo run -p meme-fortress-backend &
sleep 2
curl -s "http://localhost:8787/api/memes?exclude_seen=true&limit=5" | python3 -m json.tool | head -20
kill %1
```

Expected: meme の配列（vote_logs にないもの）

- [ ] **Step 5: commit**

```bash
git add backend/src/main.rs
git commit -m "Add exclude_seen filter to GET /api/memes"
```

---

## Task WA-3: コレクション API（backend）

**Files:**
- Modify: `backend/src/main.rs`

- [ ] **Step 1: `CollectionMeme` 型を追加**

`backend/src/main.rs` の `HealthResponse` 定義の前に追加:

```rust
#[derive(Debug, Serialize)]
struct CollectionMeme {
    id: String,
    name: String,
    name_en: Option<String>,
    description: String,
    origin: Option<String>,
    year: Option<i64>,
    era: Option<String>,
    platform: Vec<String>,
    context: Option<String>,
    tags: Vec<String>,
    nsfw: bool,
    collect_count: i64,
    last_collected_at: String,
}
```

- [ ] **Step 2: `list_collection` ハンドラを追加**

`health` 関数の前に追加:

```rust
async fn list_collection(
    State(state): State<AppState>,
) -> Result<Json<Vec<CollectionMeme>>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT
            m.id, m.name, m.name_en, m.description, m.origin, m.year, m.era,
            m.platform_json, m.context, m.tags_json, m.nsfw,
            COUNT(vl.id) as collect_count,
            MAX(vl.voted_at) as last_collected_at
        FROM memes m
        JOIN vote_logs vl ON vl.meme_id = m.id AND vl.action = 'collect'
        GROUP BY m.id
        ORDER BY collect_count DESC, m.name
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    let items = rows
        .into_iter()
        .map(|row| CollectionMeme {
            id: row.get("id"),
            name: row.get("name"),
            name_en: row.get("name_en"),
            description: row.get("description"),
            origin: row.get("origin"),
            year: row.get("year"),
            era: row.get("era"),
            platform: parse_json_array(row.get("platform_json")),
            context: row.get("context"),
            tags: parse_json_array(row.get("tags_json")),
            nsfw: row.get::<i64, _>("nsfw") != 0,
            collect_count: row.get("collect_count"),
            last_collected_at: row.get("last_collected_at"),
        })
        .collect();

    Ok(Json(items))
}
```

- [ ] **Step 3: ルーターに追加**

`backend/src/main.rs` の `api` Router を以下に変更:

```rust
let api = Router::new()
    .route("/health", get(health))
    .route("/memes", get(list_memes))
    .route("/collection", get(list_collection))   // ← 追加
    .route("/snatches", post(create_snatch))
    .route("/reveals", post(create_reveal))
    .route("/votes/sync", post(sync_votes));
```

- [ ] **Step 4: ビルド＆確認**

```bash
cargo build -p meme-fortress-backend 2>&1 | tail -5
```

Expected: `Finished`

- [ ] **Step 5: commit**

```bash
git add backend/src/main.rs
git commit -m "Add GET /api/collection endpoint"
```

---

## Task WA-4: ランキング API（backend）

**Files:**
- Modify: `backend/src/main.rs`

- [ ] **Step 1: `RankingMeme` 型を追加**

`CollectionMeme` 定義の後に追加:

```rust
#[derive(Debug, Serialize)]
struct RankingMeme {
    id: String,
    name: String,
    era: Option<String>,
    collect_count: i64,
    skip_count: i64,
    total_votes: i64,
    collect_ratio: f64,
}
```

- [ ] **Step 2: `list_ranking` ハンドラを追加**

`list_collection` の後に追加:

```rust
async fn list_ranking(
    State(state): State<AppState>,
) -> Result<Json<Vec<RankingMeme>>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT
            m.id, m.name, m.era,
            COUNT(CASE WHEN vl.action = 'collect' THEN 1 END) as collect_count,
            COUNT(CASE WHEN vl.action = 'skip' THEN 1 END) as skip_count,
            COUNT(vl.id) as total_votes
        FROM memes m
        LEFT JOIN vote_logs vl ON vl.meme_id = m.id
        GROUP BY m.id
        HAVING total_votes > 0
        ORDER BY collect_count DESC, total_votes DESC
        LIMIT 200
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    let items = rows
        .into_iter()
        .map(|row| {
            let collect: i64 = row.get("collect_count");
            let total: i64 = row.get("total_votes");
            RankingMeme {
                id: row.get("id"),
                name: row.get("name"),
                era: row.get("era"),
                collect_count: collect,
                skip_count: row.get("skip_count"),
                total_votes: total,
                collect_ratio: if total > 0 {
                    collect as f64 / total as f64
                } else {
                    0.0
                },
            }
        })
        .collect();

    Ok(Json(items))
}
```

- [ ] **Step 3: ルーターに追加**

```rust
let api = Router::new()
    .route("/health", get(health))
    .route("/memes", get(list_memes))
    .route("/collection", get(list_collection))
    .route("/ranking", get(list_ranking))           // ← 追加
    .route("/snatches", post(create_snatch))
    .route("/reveals", post(create_reveal))
    .route("/votes/sync", post(sync_votes));
```

- [ ] **Step 4: ビルド確認**

```bash
cargo build -p meme-fortress-backend 2>&1 | tail -5
```

Expected: `Finished`

- [ ] **Step 5: commit**

```bash
git add backend/src/main.rs
git commit -m "Add GET /api/ranking endpoint"
```

---

## Task WA-5: Tauri コマンド追加（src-tauri）

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Tauri用型定義を追加**

`src-tauri/src/lib.rs` の `SnatchResponse` 定義の後に追加:

```rust
#[derive(Debug, Serialize)]
struct CollectionMeme {
    id: String,
    name: String,
    name_en: Option<String>,
    description: String,
    origin: Option<String>,
    year: Option<i64>,
    era: Option<String>,
    platform: Vec<String>,
    context: Option<String>,
    tags: Vec<String>,
    nsfw: bool,
    collect_count: i64,
    last_collected_at: String,
}

#[derive(Debug, Serialize)]
struct RankingMeme {
    id: String,
    name: String,
    era: Option<String>,
    collect_count: i64,
    skip_count: i64,
    total_votes: i64,
    collect_ratio: f64,
}

#[derive(Debug, Deserialize)]
struct MemeQuery {
    limit: Option<i64>,
    exclude_seen: Option<bool>,
}
```

- [ ] **Step 2: `get_memes` Tauriコマンドを未見対応に変更**

`src-tauri/src/lib.rs` の `get_memes` 関数を探し、以下に置換（関数シグネチャと中身を変更）:

```rust
#[tauri::command]
async fn get_memes(
    state: State<'_, AppState>,
    limit: Option<i64>,
    exclude_seen: Option<bool>,
) -> Result<Vec<Meme>, String> {
    let limit = limit.unwrap_or(96).clamp(1, 500);
    let exclude = exclude_seen.unwrap_or(false);

    let rows = if exclude {
        sqlx::query(
            "SELECT m.* FROM memes m WHERE m.id NOT IN (SELECT DISTINCT meme_id FROM vote_logs) ORDER BY RANDOM() LIMIT ?",
        )
        .bind(limit)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query("SELECT * FROM memes ORDER BY RANDOM() LIMIT ?")
            .bind(limit)
            .fetch_all(&state.db)
            .await
    }
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(row_to_meme).collect())
}
```

- [ ] **Step 3: `get_collection` コマンド追加**

`get_memes` の後に追加:

```rust
#[tauri::command]
async fn get_collection(state: State<'_, AppState>) -> Result<Vec<CollectionMeme>, String> {
    let rows = sqlx::query(
        r#"
        SELECT
            m.id, m.name, m.name_en, m.description, m.origin, m.year, m.era,
            m.platform_json, m.context, m.tags_json, m.nsfw,
            COUNT(vl.id) as collect_count,
            MAX(vl.voted_at) as last_collected_at
        FROM memes m
        JOIN vote_logs vl ON vl.meme_id = m.id AND vl.action = 'collect'
        GROUP BY m.id
        ORDER BY collect_count DESC, m.name
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| CollectionMeme {
            id: row.get("id"),
            name: row.get("name"),
            name_en: row.get("name_en"),
            description: row.get("description"),
            origin: row.get("origin"),
            year: row.get("year"),
            era: row.get("era"),
            platform: parse_json_array(row.get("platform_json")),
            context: row.get("context"),
            tags: parse_json_array(row.get("tags_json")),
            nsfw: row.get::<i64, _>("nsfw") != 0,
            collect_count: row.get("collect_count"),
            last_collected_at: row.get("last_collected_at"),
        })
        .collect())
}
```

- [ ] **Step 4: `get_ranking` コマンド追加**

`get_collection` の後に追加:

```rust
#[tauri::command]
async fn get_ranking(state: State<'_, AppState>) -> Result<Vec<RankingMeme>, String> {
    let rows = sqlx::query(
        r#"
        SELECT
            m.id, m.name, m.era,
            COUNT(CASE WHEN vl.action = 'collect' THEN 1 END) as collect_count,
            COUNT(CASE WHEN vl.action = 'skip' THEN 1 END) as skip_count,
            COUNT(vl.id) as total_votes
        FROM memes m
        LEFT JOIN vote_logs vl ON vl.meme_id = m.id
        GROUP BY m.id
        HAVING total_votes > 0
        ORDER BY collect_count DESC, total_votes DESC
        LIMIT 200
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let collect: i64 = row.get("collect_count");
            let total: i64 = row.get("total_votes");
            RankingMeme {
                id: row.get("id"),
                name: row.get("name"),
                era: row.get("era"),
                collect_count: collect,
                skip_count: row.get("skip_count"),
                total_votes: total,
                collect_ratio: if total > 0 {
                    collect as f64 / total as f64
                } else {
                    0.0
                },
            }
        })
        .collect())
}
```

- [ ] **Step 5: `tauri::Builder` の `.invoke_handler` に登録**

`src-tauri/src/lib.rs` の `tauri::generate_handler![]` 内に追加:

```rust
tauri::generate_handler![
    get_memes,
    create_snatch,
    create_reveal,
    sync_votes,
    get_collection,   // ← 追加
    get_ranking,      // ← 追加
]
```

- [ ] **Step 6: ビルド確認**

```bash
cargo build -p meme-fortress-tauri 2>&1 | tail -5
```

Expected: `Finished`

- [ ] **Step 7: commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "Add get_collection and get_ranking Tauri commands"
```

---

## Task WB-1: 型定義・APIクライアント追加（frontend）

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: `frontend/src/types.ts` に型追加**

ファイル末尾に追加:

```typescript
export type Page = "snatch" | "collection" | "ranking";

export type CollectionMeme = {
  id: string;
  name: string;
  name_en?: string | null;
  description: string;
  origin?: string | null;
  year?: number | null;
  era?: string | null;
  platform: string[];
  context?: string | null;
  tags: string[];
  nsfw: boolean;
  collect_count: number;
  last_collected_at: string;
};

export type RankingMeme = {
  id: string;
  name: string;
  era?: string | null;
  collect_count: number;
  skip_count: number;
  total_votes: number;
  collect_ratio: number;
};
```

- [ ] **Step 2: `frontend/src/api.ts` にインポート追加**

`types.ts` インポート行を以下に更新:

```typescript
import type { CollectionMeme, Meme, RankingMeme, RevealResponse, SnatchResponse, VoteSyncResponse } from "./types";
```

- [ ] **Step 3: `fetchMemes` に `excludeSeen` オプション追加**

`fetchMemes` 関数を以下に置換:

```typescript
export function fetchMemes(excludeSeen = false) {
  const limit = 120;
  if (isTauri()) {
    return invokeTauri<Meme[]>("get_memes", { limit, excludeSeen });
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (excludeSeen) params.set("exclude_seen", "true");
  return request<Meme[]>(`/api/memes?${params}`);
}
```

- [ ] **Step 4: `fetchCollection` と `fetchRanking` を追加**

`syncVotes` の後に追加:

```typescript
export function fetchCollection() {
  if (isTauri()) {
    return invokeTauri<CollectionMeme[]>("get_collection");
  }
  return request<CollectionMeme[]>("/api/collection");
}

export function fetchRanking() {
  if (isTauri()) {
    return invokeTauri<RankingMeme[]>("get_ranking");
  }
  return request<RankingMeme[]>("/api/ranking");
}
```

- [ ] **Step 5: TypeScript 型チェック**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: エラーなし（または既存の無関係エラーのみ）

- [ ] **Step 6: commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts
git commit -m "Add Collection/Ranking types and API client functions"
```

---

## Task WB-2: ナビゲーションバー（frontend）

**Files:**
- Create: `frontend/src/components/NavBar.tsx`

- [ ] **Step 1: `frontend/src/components/NavBar.tsx` を作成**

```tsx
import { Archive, BarChart2, Zap } from "lucide-react";
import type { Page } from "../types";

export function NavBar({
  current,
  onNavigate,
  unseenCount,
  collectionCount,
}: {
  current: Page;
  onNavigate: (page: Page) => void;
  unseenCount: number;
  collectionCount: number;
}) {
  return (
    <nav className="navbar">
      <button
        className={current === "snatch" ? "nav-btn active" : "nav-btn"}
        onClick={() => onNavigate("snatch")}
      >
        <Zap size={18} />
        スナッチ
        {unseenCount > 0 && <span className="badge">{unseenCount}</span>}
      </button>
      <button
        className={current === "collection" ? "nav-btn active" : "nav-btn"}
        onClick={() => onNavigate("collection")}
      >
        <Archive size={18} />
        コレクション
        {collectionCount > 0 && <span className="badge">{collectionCount}</span>}
      </button>
      <button
        className={current === "ranking" ? "nav-btn active" : "nav-btn"}
        onClick={() => onNavigate("ranking")}
      >
        <BarChart2 size={18} />
        ランキング
      </button>
    </nav>
  );
}
```

- [ ] **Step 2: NavBar用スタイルを `frontend/src/styles.css` に追加**

`styles.css` 末尾に追加:

```css
/* ===== NavBar ===== */
.navbar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--surface, #1a1a2e);
  border-bottom: 2px solid var(--accent, #e94560);
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border: 2px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #aaa);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}

.nav-btn:hover {
  border-color: var(--accent, #e94560);
  color: var(--text, #fff);
}

.nav-btn.active {
  background: var(--accent, #e94560);
  color: #fff;
}

.nav-btn .badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: #f5a623;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 900;
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 3: TypeScript 型チェック**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -10
```

Expected: エラーなし

- [ ] **Step 4: commit**

```bash
git add frontend/src/components/NavBar.tsx frontend/src/styles.css
git commit -m "Add NavBar component with page navigation"
```

---

## Task WB-3: コレクション画面（frontend）

**Files:**
- Create: `frontend/src/pages/CollectionPage.tsx`

- [ ] **Step 1: `frontend/src/pages/` ディレクトリ作成**

```bash
mkdir -p frontend/src/pages
```

- [ ] **Step 2: `frontend/src/pages/CollectionPage.tsx` を作成**

```tsx
import { useEffect, useState } from "react";
import { Archive, Star } from "lucide-react";
import { fetchCollection } from "../api";
import type { CollectionMeme } from "../types";

const ERA_ORDER = [
  "フラッシュ倉庫時代",
  "ニコニコ動画時代前期",
  "ニコニコ動画時代後期",
  "Twitter時代以前",
  "Twitter爆発時代",
  "TikTok時代",
  "TikTok時代以降",
];

export function CollectionPage() {
  const [items, setItems] = useState<CollectionMeme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEra, setSelectedEra] = useState<string>("all");

  useEffect(() => {
    fetchCollection()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const eras = ["all", ...ERA_ORDER.filter((era) => items.some((item) => item.era === era))];

  const filtered =
    selectedEra === "all" ? items : items.filter((item) => item.era === selectedEra);

  if (loading) return <div className="panel loading-panel">コレクション読込中...</div>;
  if (error) return <div className="panel error-panel">{error}</div>;

  return (
    <div className="collection-page">
      <section className="panel collection-header">
        <div>
          <span className="section-title">
            <Archive size={18} /> 電脳ミーム大百科
          </span>
          <p>
            <strong>{items.length}</strong> 件のミームをコレクション済み
          </p>
        </div>
      </section>

      <div className="era-tabs">
        {eras.map((era) => (
          <button
            key={era}
            className={selectedEra === era ? "era-tab active" : "era-tab"}
            onClick={() => setSelectedEra(era)}
          >
            {era === "all" ? "全時代" : era}
            <span className="era-count">
              {era === "all"
                ? items.length
                : items.filter((i) => i.era === era).length}
            </span>
          </button>
        ))}
      </div>

      <div className="collection-grid">
        {filtered.map((meme, rank) => (
          <article key={meme.id} className="collection-card">
            <div className="collection-rank">
              {rank < 3 ? <Star size={14} fill="gold" color="gold" /> : null}
              #{rank + 1}
            </div>
            <h3>{meme.name}</h3>
            {meme.name_en && <p className="name-en">{meme.name_en}</p>}
            <p className="meme-desc">{meme.description}</p>
            <div className="collection-meta">
              <span>{meme.era || "時代不明"}</span>
              {meme.year && <span>{meme.year}年</span>}
              <span className="collect-badge">
                ×{meme.collect_count} collect
              </span>
              {meme.nsfw && <span className="danger">禁断</span>}
            </div>
            <div className="collection-tags">
              {meme.tags.slice(0, 4).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="panel">
          <p>このエラ・時代のコレクションはまだありません。スナッチして集めよう！</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: コレクション画面用スタイルを `styles.css` に追加**

```css
/* ===== Collection Page ===== */
.collection-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.collection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.era-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.era-tab {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.75rem;
  border: 2px solid var(--border, #333);
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted, #aaa);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.era-tab.active,
.era-tab:hover {
  border-color: var(--accent, #e94560);
  color: var(--text, #fff);
}

.era-count {
  background: var(--surface2, #222);
  border-radius: 999px;
  padding: 0 6px;
  font-size: 0.7rem;
}

.collection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.collection-card {
  background: var(--surface, #1a1a2e);
  border: 2px solid var(--border, #333);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.15s;
}

.collection-card:hover {
  border-color: var(--accent, #e94560);
}

.collection-rank {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-muted, #aaa);
  font-weight: 700;
}

.collection-card h3 {
  font-size: 1.05rem;
  font-weight: 900;
  margin: 0;
}

.name-en {
  font-size: 0.8rem;
  color: var(--text-muted, #aaa);
  margin: 0;
}

.meme-desc {
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collection-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.75rem;
}

.collection-meta span {
  background: var(--surface2, #222);
  border-radius: 4px;
  padding: 2px 6px;
}

.collect-badge {
  background: #1a3a1a !important;
  color: #4caf50;
  font-weight: 700;
}

.collection-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.collection-tags span {
  font-size: 0.7rem;
  padding: 2px 6px;
  border: 1px solid var(--border, #333);
  border-radius: 4px;
  color: var(--text-muted, #aaa);
}
```

- [ ] **Step 4: TypeScript 型チェック**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -10
```

Expected: エラーなし

- [ ] **Step 5: commit**

```bash
git add frontend/src/pages/CollectionPage.tsx frontend/src/styles.css
git commit -m "Add CollectionPage with era filtering"
```

---

## Task WC-1: ランキング画面（frontend）

**Files:**
- Create: `frontend/src/pages/RankingPage.tsx`

- [ ] **Step 1: `frontend/src/pages/RankingPage.tsx` を作成**

```tsx
import { useEffect, useState } from "react";
import { BarChart2, TrendingUp } from "lucide-react";
import { fetchRanking } from "../api";
import type { RankingMeme } from "../types";

type SortKey = "collect_count" | "collect_ratio" | "total_votes";

export function RankingPage() {
  const [items, setItems] = useState<RankingMeme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("collect_count");

  useEffect(() => {
    fetchRanking()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...items].sort((a, b) => b[sortKey] - a[sortKey]);

  if (loading) return <div className="panel loading-panel">ランキング集計中...</div>;
  if (error) return <div className="panel error-panel">{error}</div>;

  return (
    <div className="ranking-page">
      <section className="panel ranking-header">
        <div>
          <span className="section-title">
            <BarChart2 size={18} /> 人気ミームランキング
          </span>
          <p>
            <strong>{items.length}</strong> 件集計済み
          </p>
        </div>
        <div className="sort-buttons">
          <span>並び替え：</span>
          {(
            [
              ["collect_count", "collect数"],
              ["collect_ratio", "collect率"],
              ["total_votes", "投票数"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={sortKey === key ? "sort-btn active" : "sort-btn"}
              onClick={() => setSortKey(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="ranking-list">
        {sorted.map((meme, index) => (
          <div key={meme.id} className="ranking-row">
            <div className="ranking-position">
              {index < 3 ? (
                <span className={`medal medal-${index + 1}`}>
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                </span>
              ) : (
                <span className="rank-num">{index + 1}</span>
              )}
            </div>
            <div className="ranking-info">
              <h3>{meme.name}</h3>
              <span className="meme-era">{meme.era || "時代不明"}</span>
            </div>
            <div className="ranking-stats">
              <span className="stat collect">
                <TrendingUp size={13} />
                {meme.collect_count}
              </span>
              <span className="stat ratio">
                {Math.round(meme.collect_ratio * 100)}%
              </span>
              <div className="ratio-bar">
                <i style={{ width: `${meme.collect_ratio * 100}%` }} />
              </div>
              <span className="stat total">{meme.total_votes}票</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ランキング用スタイルを `styles.css` に追加**

```css
/* ===== Ranking Page ===== */
.ranking-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.ranking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.sort-buttons {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.sort-btn {
  padding: 0.3rem 0.7rem;
  border: 2px solid var(--border, #333);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #aaa);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.sort-btn.active,
.sort-btn:hover {
  border-color: var(--accent, #e94560);
  color: var(--text, #fff);
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ranking-row {
  display: grid;
  grid-template-columns: 3rem 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface, #1a1a2e);
  border: 2px solid var(--border, #333);
  border-radius: 8px;
  transition: border-color 0.15s;
}

.ranking-row:hover {
  border-color: var(--accent, #e94560);
}

.ranking-position {
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-num {
  font-size: 1rem;
  font-weight: 900;
  color: var(--text-muted, #aaa);
}

.medal {
  font-size: 1.4rem;
}

.ranking-info h3 {
  font-size: 0.95rem;
  font-weight: 900;
  margin: 0 0 0.15rem;
}

.meme-era {
  font-size: 0.75rem;
  color: var(--text-muted, #aaa);
}

.ranking-stats {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  font-weight: 700;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.stat.collect {
  color: #4caf50;
  min-width: 3rem;
}

.stat.ratio {
  min-width: 3rem;
  text-align: right;
}

.stat.total {
  color: var(--text-muted, #aaa);
  min-width: 3rem;
}

.ratio-bar {
  width: 60px;
  height: 6px;
  background: var(--border, #333);
  border-radius: 3px;
  overflow: hidden;
}

.ratio-bar i {
  display: block;
  height: 100%;
  background: var(--accent, #e94560);
  border-radius: 3px;
  transition: width 0.3s;
}
```

- [ ] **Step 3: TypeScript 型チェック**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -10
```

Expected: エラーなし

- [ ] **Step 4: commit**

```bash
git add frontend/src/pages/RankingPage.tsx frontend/src/styles.css
git commit -m "Add RankingPage with sort by collect/ratio/votes"
```

---

## Task WB-4: App.tsx にページ遷移組込（frontend）

**前提:** WB-1〜WB-3、WC-1 が完了していること

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: インポート追加**

`frontend/src/App.tsx` のインポート部分に追加:

```typescript
import type { Page } from "./types";
import { NavBar } from "./components/NavBar";
import { CollectionPage } from "./pages/CollectionPage";
import { RankingPage } from "./pages/RankingPage";
```

- [ ] **Step 2: ページ状態・カウント系 state 追加**

`App` 関数内の既存 state 宣言（`loading` の後）に追加:

```typescript
const [page, setPage] = useState<Page>("snatch");
const [unseenCount, setUnseenCount] = useState(0);
const [collectionCount, setCollectionCount] = useState(0);
```

- [ ] **Step 3: `fetchMemes` 呼び出しを未見優先に変更**

既存の `fetchMemes()` 呼び出し (`useEffect` 内) を以下に置換:

```typescript
useEffect(() => {
  fetchMemes(true)  // exclude_seen=true
    .then((data) => {
      setMemes(data);
      setUnseenCount(data.length);
    })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
}, []);
```

- [ ] **Step 4: コレクション件数を起動時に取得する useEffect を追加**

`fetchMemes` の useEffect の後に追加:

```typescript
useEffect(() => {
  fetchCollection()
    .then((data) => setCollectionCount(data.length))
    .catch(() => {}); // バッジ更新に失敗しても無視
}, []);
```

`api.ts` からの import に `fetchCollection` を追加するのを忘れずに:

```typescript
import { createSnatch, fetchCollection, fetchMemes, syncVotes } from "./api";
```

- [ ] **Step 5: `return` のルートに NavBar を追加**

`<main>` タグの直後（`<ScatteredDecorations />` の前）に挿入:

```tsx
<NavBar
  current={page}
  onNavigate={setPage}
  unseenCount={unseenCount}
  collectionCount={collectionCount}
/>
```

- [ ] **Step 6: ページ切替レンダリングを追加**

既存の `{!loading && !error && (` ブロック全体（`</main>` の手前まで）を以下に置換。
`game-grid` の JSX は**現行ファイルのものをそのままコピー**し、`page === "snatch"` の条件でラップする:

```tsx
{!loading && !error && page === "collection" && <CollectionPage />}
{!loading && !error && page === "ranking" && <RankingPage />}
{!loading && !error && page === "snatch" && (
  <div className="game-grid">
    {/* ここに現行 App.tsx の game-grid 内容をそのままコピー */}
    {/* arena section と aside.side-stack の両方を含む */}
  </div>
)}
```

**注意:** `game-grid` の内部コードは一切変更しない。ラッパー条件を追加するだけ。

- [ ] **Step 6: TypeScript 型チェック**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: エラーなし

- [ ] **Step 7: ビルド確認**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `dist/` に成果物が生成される

- [ ] **Step 8: commit**

```bash
git add frontend/src/App.tsx
git commit -m "Wire NavBar and page routing into App (collection/ranking/snatch)"
```

---

## マージ手順（全ワークツリー完了後）

```bash
# WA を main にマージ
git checkout main
git merge feature/backend-apis --no-ff -m "Merge backend APIs (unseen feed, collection, ranking)"

# WB をマージ
git merge feature/frontend-nav-col --no-ff -m "Merge frontend nav + collection"

# WC をマージ
git merge feature/frontend-ranking --no-ff -m "Merge frontend ranking"

# ワークツリー削除
git worktree remove ../meme-fortress-wa
git worktree remove ../meme-fortress-wb
git worktree remove ../meme-fortress-wc
```

---

## 動作確認チェックリスト（マージ後）

- [ ] `cargo run -p meme-fortress-backend` が起動時に vote sync を実行する
- [ ] `GET /api/memes?exclude_seen=true` が vote_logs にないミームを返す
- [ ] `GET /api/collection` が collect 済みミームを collect_count 降順で返す
- [ ] `GET /api/ranking` が collect_count/ratio/total_votes を返す
- [ ] フロントエンドでスナッチ→コレクション→ランキングのページ遷移ができる
- [ ] コレクション画面でエラ・時代フィルタが機能する
- [ ] ランキング画面でソート切替が機能する

---

## 将来タスク（今回スコープ外）

- 称号システム（collect数に応じたバッジ）
- 効果音・スクリーンシェイク強化
- マルチユーザー対応
- コレクション画面の collect_count を NavBar に反映
- `memes_seed.json` を Google Sheets のミームマスタ（別シート想定）から自動生成
