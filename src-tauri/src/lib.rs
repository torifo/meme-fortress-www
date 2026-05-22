use std::{env, path::PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool, sqlite::SqlitePoolOptions};
use tauri::{Manager, State};
use uuid::Uuid;

const DEFAULT_VOTES_CSV_URL: &str = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRFCg0pB6rskTpyNYwgswvxJbRgcTkCYtsIIQCodZxvINGuCGkRW_MkOf5eOSx2yktiLtnGZboi5R4-/pub?output=csv";

#[derive(Clone)]
struct AppState {
    db: SqlitePool,
}

#[derive(Debug, Deserialize)]
struct SeedFile {
    meta: SeedMeta,
    memes: Vec<SeedMeme>,
}

#[derive(Debug, Deserialize)]
struct SeedMeta {
    collected_at: Option<String>,
    total: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize)]
struct SeedMeme {
    id: String,
    name: String,
    name_en: Option<String>,
    description: String,
    origin: Option<String>,
    year: Option<i64>,
    era: Option<String>,
    platform: Option<Vec<String>>,
    context: Option<String>,
    visual_features: Option<String>,
    tags: Option<Vec<String>>,
    region: Option<String>,
    format: Option<Vec<String>>,
    source: Option<String>,
    nsfw: Option<bool>,
}

#[derive(Debug, Serialize)]
struct Meme {
    id: String,
    name: String,
    name_en: Option<String>,
    description: String,
    origin: Option<String>,
    year: Option<i64>,
    era: Option<String>,
    platform: Vec<String>,
    context: Option<String>,
    visual_features: Option<String>,
    tags: Vec<String>,
    region: Option<String>,
    format: Vec<String>,
    source: Option<String>,
    nsfw: bool,
}

#[derive(Debug, Deserialize)]
struct SnatchRequest {
    meme_id: String,
    source_area: String,
    timing_score: f64,
}

#[derive(Debug, Serialize)]
struct SnatchResponse {
    snatch_id: String,
    postcard_code: String,
    meme: Meme,
}

#[derive(Debug, Deserialize)]
struct RevealRequest {
    snatch_id: String,
    revealed_ratio: f64,
}

#[derive(Debug, Serialize)]
struct RevealResponse {
    reveal_id: String,
    meme: Meme,
    revealed_ratio: f64,
    message: String,
}

#[derive(Debug, Serialize)]
struct VoteSyncResponse {
    source_url: String,
    fetched_rows: usize,
    inserted_rows: u64,
    total_rows: i64,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db = tauri::async_runtime::block_on(init_database())
                .map_err(|error| Box::<dyn std::error::Error>::from(error.to_string()))?;
            app.manage(AppState { db });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_memes,
            create_snatch,
            create_reveal,
            sync_votes
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}

#[tauri::command]
async fn get_memes(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<Meme>, String> {
    let rows = sqlx::query("SELECT * FROM memes ORDER BY RANDOM() LIMIT ?")
        .bind(limit.unwrap_or(120).clamp(1, 500))
        .fetch_all(&state.db)
        .await
        .map_err(to_message)?;

    Ok(rows.into_iter().map(row_to_meme).collect())
}

#[tauri::command]
async fn create_snatch(
    state: State<'_, AppState>,
    payload: SnatchRequest,
) -> Result<SnatchResponse, String> {
    let meme = find_meme(&state.db, &payload.meme_id).await?;
    let snatch_id = Uuid::new_v4().to_string();
    let postcard_code = format!("MF-{}", &snatch_id[..8].to_uppercase());
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO snatches (id, meme_id, source_area, timing_score, postcard_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&snatch_id)
    .bind(&payload.meme_id)
    .bind(payload.source_area)
    .bind(payload.timing_score.clamp(0.0, 1.0))
    .bind(&postcard_code)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(to_message)?;

    Ok(SnatchResponse {
        snatch_id,
        postcard_code,
        meme,
    })
}

#[tauri::command]
async fn create_reveal(
    state: State<'_, AppState>,
    payload: RevealRequest,
) -> Result<RevealResponse, String> {
    let row = sqlx::query("SELECT meme_id FROM snatches WHERE id = ?")
        .bind(&payload.snatch_id)
        .fetch_optional(&state.db)
        .await
        .map_err(to_message)?
        .ok_or_else(|| "snatch not found".to_string())?;
    let meme_id: String = row.get("meme_id");
    let meme = find_meme(&state.db, &meme_id).await?;
    let reveal_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let ratio = payload.revealed_ratio.clamp(0.0, 1.0);

    sqlx::query(
        r#"
        INSERT INTO reveals (id, snatch_id, meme_id, revealed_ratio, created_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&reveal_id)
    .bind(&payload.snatch_id)
    .bind(&meme_id)
    .bind(ratio)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(to_message)?;

    sqlx::query("UPDATE snatches SET opened_at = ? WHERE id = ?")
        .bind(now)
        .bind(&payload.snatch_id)
        .execute(&state.db)
        .await
        .map_err(to_message)?;

    Ok(RevealResponse {
        reveal_id,
        meme,
        revealed_ratio: ratio,
        message: "衝撃の真実！神バズり確定！".to_string(),
    })
}

#[tauri::command]
async fn sync_votes(state: State<'_, AppState>) -> Result<VoteSyncResponse, String> {
    sync_votes_from_sheet(&state.db).await.map_err(to_message)
}

async fn init_database() -> anyhow::Result<SqlitePool> {
    let data_dir = workspace_path("data");
    tokio::fs::create_dir_all(&data_dir).await?;
    let db_path = data_dir.join("meme-fortress.sqlite");
    let database_url = format!("sqlite://{}?mode=rwc", db_path.display());
    let db = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    migrate(&db).await?;
    seed_memes(&db).await?;
    Ok(db)
}

async fn migrate(db: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS memes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          name_en TEXT,
          description TEXT NOT NULL,
          origin TEXT,
          year INTEGER,
          era TEXT,
          platform_json TEXT NOT NULL,
          context TEXT,
          visual_features TEXT,
          tags_json TEXT NOT NULL,
          region TEXT,
          format_json TEXT NOT NULL,
          source TEXT,
          nsfw INTEGER NOT NULL DEFAULT 0,
          seed_collected_at TEXT,
          updated_at TEXT NOT NULL
        );
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS snatches (
          id TEXT PRIMARY KEY,
          meme_id TEXT NOT NULL,
          source_area TEXT NOT NULL,
          timing_score REAL NOT NULL,
          postcard_code TEXT NOT NULL,
          created_at TEXT NOT NULL,
          opened_at TEXT,
          FOREIGN KEY (meme_id) REFERENCES memes(id)
        );
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reveals (
          id TEXT PRIMARY KEY,
          snatch_id TEXT NOT NULL,
          meme_id TEXT NOT NULL,
          revealed_ratio REAL NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (snatch_id) REFERENCES snatches(id),
          FOREIGN KEY (meme_id) REFERENCES memes(id)
        );
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS vote_logs (
          id TEXT PRIMARY KEY,
          voted_at TEXT NOT NULL,
          meme_id TEXT NOT NULL,
          action TEXT NOT NULL,
          meme_name TEXT NOT NULL,
          era TEXT NOT NULL,
          source_url TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          UNIQUE (voted_at, meme_id, action, meme_name, era)
        );
        "#,
    )
    .execute(db)
    .await?;
    Ok(())
}

async fn seed_memes(db: &SqlitePool) -> anyhow::Result<()> {
    let raw = tokio::fs::read_to_string(workspace_path("docs/memes_seed.json")).await?;
    let seed: SeedFile = serde_json::from_str(&raw)?;
    let now = Utc::now().to_rfc3339();

    for meme in seed.memes {
        sqlx::query(
            r#"
            INSERT INTO memes (
              id, name, name_en, description, origin, year, era, platform_json,
              context, visual_features, tags_json, region, format_json, source,
              nsfw, seed_collected_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              name_en = excluded.name_en,
              description = excluded.description,
              origin = excluded.origin,
              year = excluded.year,
              era = excluded.era,
              platform_json = excluded.platform_json,
              context = excluded.context,
              visual_features = excluded.visual_features,
              tags_json = excluded.tags_json,
              region = excluded.region,
              format_json = excluded.format_json,
              source = excluded.source,
              nsfw = excluded.nsfw,
              seed_collected_at = excluded.seed_collected_at,
              updated_at = excluded.updated_at;
            "#,
        )
        .bind(meme.id)
        .bind(meme.name)
        .bind(meme.name_en)
        .bind(meme.description)
        .bind(meme.origin)
        .bind(meme.year)
        .bind(meme.era)
        .bind(serde_json::to_string(&meme.platform.unwrap_or_default())?)
        .bind(meme.context)
        .bind(meme.visual_features)
        .bind(serde_json::to_string(&meme.tags.unwrap_or_default())?)
        .bind(meme.region)
        .bind(serde_json::to_string(&meme.format.unwrap_or_default())?)
        .bind(meme.source)
        .bind(i64::from(meme.nsfw.unwrap_or(false)))
        .bind(seed.meta.collected_at.clone())
        .bind(&now)
        .execute(db)
        .await?;
    }

    if let Some(total) = seed.meta.total {
        println!("seeded meme-fortress db; declared total={total}");
    }

    Ok(())
}

async fn find_meme(db: &SqlitePool, id: &str) -> Result<Meme, String> {
    let row = sqlx::query("SELECT * FROM memes WHERE id = ?")
        .bind(id)
        .fetch_optional(db)
        .await
        .map_err(to_message)?
        .ok_or_else(|| "meme not found".to_string())?;
    Ok(row_to_meme(row))
}

async fn sync_votes_from_sheet(db: &SqlitePool) -> anyhow::Result<VoteSyncResponse> {
    let source_url =
        env::var("SHEET_VOTES_CSV_URL").unwrap_or_else(|_| DEFAULT_VOTES_CSV_URL.to_string());
    let body = reqwest::get(&source_url)
        .await?
        .error_for_status()?
        .text()
        .await?;
    let imported_at = Utc::now().to_rfc3339();
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(body.as_bytes());
    let mut fetched_rows = 0usize;
    let mut inserted_rows = 0u64;

    for record in reader.records() {
        let record = record?;
        if record.len() < 5 {
            continue;
        }
        let voted_at = clean_csv_cell(&record[0]);
        let meme_id = clean_csv_cell(&record[1]);
        let action = clean_csv_cell(&record[2]);
        let meme_name = clean_csv_cell(&record[3]);
        let era = clean_csv_cell(&record[4]);
        if voted_at.is_empty() || meme_id.is_empty() || action.is_empty() {
            continue;
        }
        fetched_rows += 1;
        let id = stable_vote_id(&voted_at, &meme_id, &action, &meme_name, &era);
        let result = sqlx::query(
            r#"
            INSERT OR IGNORE INTO vote_logs (
              id, voted_at, meme_id, action, meme_name, era, source_url, imported_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(voted_at)
        .bind(meme_id)
        .bind(action)
        .bind(meme_name)
        .bind(era)
        .bind(&source_url)
        .bind(&imported_at)
        .execute(db)
        .await?;
        inserted_rows += result.rows_affected();
    }

    let total_rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vote_logs")
        .fetch_one(db)
        .await?;

    Ok(VoteSyncResponse {
        source_url,
        fetched_rows,
        inserted_rows,
        total_rows,
    })
}

fn row_to_meme(row: sqlx::sqlite::SqliteRow) -> Meme {
    Meme {
        id: row.get("id"),
        name: row.get("name"),
        name_en: row.get("name_en"),
        description: row.get("description"),
        origin: row.get("origin"),
        year: row.get("year"),
        era: row.get("era"),
        platform: parse_json_array(row.get("platform_json")),
        context: row.get("context"),
        visual_features: row.get("visual_features"),
        tags: parse_json_array(row.get("tags_json")),
        region: row.get("region"),
        format: parse_json_array(row.get("format_json")),
        source: row.get("source"),
        nsfw: row.get::<i64, _>("nsfw") != 0,
    }
}

fn parse_json_array(value: String) -> Vec<String> {
    serde_json::from_str(&value).unwrap_or_default()
}

fn clean_csv_cell(value: &str) -> String {
    value.trim().to_string()
}

fn stable_vote_id(
    voted_at: &str,
    meme_id: &str,
    action: &str,
    meme_name: &str,
    era: &str,
) -> String {
    let input = format!("{voted_at}|{meme_id}|{action}|{meme_name}|{era}");
    let mut hash = 0xcbf29ce484222325u64;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("vote-{hash:016x}")
}

fn workspace_path(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(path)
}

fn to_message(error: impl std::fmt::Display) -> String {
    error.to_string()
}
