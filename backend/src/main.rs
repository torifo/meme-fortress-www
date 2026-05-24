use std::{env, net::SocketAddr, path::PathBuf};

use anyhow::{Context, Result};
use axum::{
    Json, Router,
    extract::{Query, State},
    http::Method,
    response::IntoResponse,
    routing::{get, post},
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool, sqlite::SqlitePoolOptions};
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
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
struct MemeQuery {
    limit: Option<i64>,
    exclude_seen: Option<bool>,
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
struct HealthResponse {
    ok: bool,
    meme_count: i64,
}

#[derive(Debug, Serialize)]
struct VoteSyncResponse {
    source_url: String,
    fetched_rows: usize,
    inserted_rows: u64,
    total_rows: i64,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let db = open_database().await?;
    migrate(&db).await?;
    seed_memes(&db).await?;

    // 起動時に Google Sheets の vote_logs を非同期で同期（失敗しても続行）
    if let Err(err) = sync_votes_from_sheet(&db).await {
        tracing::warn!("startup vote sync failed (non-fatal): {err}");
    }

    let state = AppState { db };
    let api = Router::new()
        .route("/health", get(health))
        .route("/memes", get(list_memes))
        .route("/snatches", post(create_snatch))
        .route("/reveals", post(create_reveal))
        .route("/votes/sync", post(sync_votes));

    let frontend_dir = workspace_path("frontend/dist");
    let spa_service =
        ServeDir::new(&frontend_dir).fallback(ServeFile::new(frontend_dir.join("index.html")));

    let app = Router::new()
        .nest("/api", api)
        .fallback_service(spa_service)
        .layer(
            CorsLayer::new()
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_origin(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let port = env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8787);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!("meme fortress backend listening on http://{addr}");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

async fn open_database() -> Result<SqlitePool> {
    let data_dir = workspace_path("data");
    tokio::fs::create_dir_all(&data_dir).await?;
    let db_path = data_dir.join("meme-fortress.sqlite");
    let database_url = format!("sqlite://{}?mode=rwc", db_path.display());

    SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .with_context(|| format!("failed to connect to {database_url}"))
}

async fn migrate(db: &SqlitePool) -> Result<()> {
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

async fn seed_memes(db: &SqlitePool) -> Result<()> {
    let seed_path = workspace_path("docs/memes_seed.json");
    let raw = tokio::fs::read_to_string(&seed_path)
        .await
        .with_context(|| format!("failed to read {}", seed_path.display()))?;
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
        tracing::info!("seeded memes from docs/memes_seed.json; declared total={total}");
    }

    Ok(())
}

async fn health(State(state): State<AppState>) -> Result<Json<HealthResponse>, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM memes")
        .fetch_one(&state.db)
        .await?;

    Ok(Json(HealthResponse {
        ok: true,
        meme_count: count,
    }))
}

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

async fn create_snatch(
    State(state): State<AppState>,
    Json(payload): Json<SnatchRequest>,
) -> Result<Json<SnatchResponse>, AppError> {
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
    .await?;

    Ok(Json(SnatchResponse {
        snatch_id,
        postcard_code,
        meme,
    }))
}

async fn create_reveal(
    State(state): State<AppState>,
    Json(payload): Json<RevealRequest>,
) -> Result<Json<RevealResponse>, AppError> {
    let row = sqlx::query("SELECT meme_id FROM snatches WHERE id = ?")
        .bind(&payload.snatch_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("snatch not found"))?;
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
    .await?;

    sqlx::query("UPDATE snatches SET opened_at = ? WHERE id = ?")
        .bind(now)
        .bind(&payload.snatch_id)
        .execute(&state.db)
        .await?;

    Ok(Json(RevealResponse {
        reveal_id,
        meme,
        revealed_ratio: ratio,
        message: "衝撃の真実！神バズり確定！".to_string(),
    }))
}

async fn sync_votes(State(state): State<AppState>) -> Result<Json<VoteSyncResponse>, AppError> {
    let result = sync_votes_from_sheet(&state.db)
        .await
        .map_err(|error| AppError {
            status: axum::http::StatusCode::BAD_GATEWAY,
            message: error.to_string(),
        })?;
    Ok(Json(result))
}

async fn sync_votes_from_sheet(db: &SqlitePool) -> Result<VoteSyncResponse> {
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

async fn find_meme(db: &SqlitePool, id: &str) -> Result<Meme, AppError> {
    let row = sqlx::query("SELECT * FROM memes WHERE id = ?")
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::not_found("meme not found"))?;
    Ok(row_to_meme(row))
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

#[derive(Debug)]
struct AppError {
    status: axum::http::StatusCode,
    message: String,
}

impl AppError {
    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: axum::http::StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }
}

impl<E> From<E> for AppError
where
    E: std::error::Error,
{
    fn from(error: E) -> Self {
        Self {
            status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            message: error.to_string(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let body = Json(serde_json::json!({ "error": self.message }));
        (self.status, body).into_response()
    }
}
