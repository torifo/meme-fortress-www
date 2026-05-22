import { useEffect, useMemo, useState } from "react";
import { DatabaseZap, Flame, Gauge, Hand, RefreshCcw, Shield, Sparkles, Zap } from "lucide-react";
import { createSnatch, fetchMemes, syncVotes } from "./api";
import { CornerRibbon } from "./components/CornerRibbon";
import { ScatteredDecorations } from "./components/ScatteredDecorations";
import { ScratchCard } from "./components/ScratchCard";
import type { Meme, RevealResponse, SnatchResponse, VoteSyncResponse } from "./types";

type Phase = "snatch" | "scratch" | "revealed";

const AREA_NAMES = ["Xの樹海", "インスタ山脈", "TikTok舞台", "Facebook古戦場"];

export function App() {
  const [memes, setMemes] = useState<Meme[]>([]);
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<Phase>("snatch");
  const [snatch, setSnatch] = useState<SnatchResponse | null>(null);
  const [reveal, setReveal] = useState<RevealResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(false);
  const [syncingVotes, setSyncingVotes] = useState(false);
  const [voteSync, setVoteSync] = useState<VoteSyncResponse | null>(null);

  useEffect(() => {
    fetchMemes()
      .then(setMemes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (phase !== "snatch" || memes.length === 0) return;
    const timer = window.setInterval(() => {
      setCursor((current) => (current + 1) % memes.length);
    }, 820);
    return () => window.clearInterval(timer);
  }, [phase, memes.length]);

  const activeMeme = memes[cursor];
  const feed = useMemo(() => {
    if (!memes.length) return [];
    return Array.from({ length: 8 }, (_, index) => memes[(cursor + index) % memes.length]);
  }, [cursor, memes]);

  const handleSnatch = async () => {
    if (!activeMeme) return;
    setBurst(true);
    const score = 0.62 + Math.random() * 0.38;
    const response = await createSnatch(activeMeme, score);
    setSnatch(response);
    window.setTimeout(() => {
      setBurst(false);
      setPhase("scratch");
    }, 540);
  };

  const resetRun = () => {
    setPhase("snatch");
    setSnatch(null);
    setReveal(null);
    setCursor((value) => (value + 5) % Math.max(memes.length, 1));
  };

  const handleSyncVotes = async () => {
    setSyncingVotes(true);
    setError(null);
    try {
      const result = await syncVotes();
      setVoteSync(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "vote sync failed");
    } finally {
      setSyncingVotes(false);
    }
  };

  return (
    <main className={burst ? "app-shell is-shaking" : "app-shell"}>
      <ScatteredDecorations />
      <section className="topbar">
        <div>
          <p className="eyebrow">超絶 電脳ミーム要塞</p>
          <h1>ネットの激流から伝説をブッこ抜け！</h1>
        </div>
        <div className="db-badge">
          <Shield size={18} />
          Rust + SQLite
        </div>
      </section>

      {error && <div className="panel error-panel">{error}</div>}
      {loading && <div className="panel loading-panel">ミーム弾薬を装填中...</div>}

      {!loading && !error && (
        <div className="game-grid">
          <section className="panel arena impact-lines">
            <CornerRibbon label={phase === "snatch" ? "SNATCH!!" : "OPEN!!"} />
            <div className="arena-head">
              <div>
                <span className="section-title">爆速スクロール・スナッチ</span>
                <p>架空SNSを流れる投稿カードをタイミングで捕獲。成功ログは backend の SQLite に保存されます。</p>
              </div>
              <div className="counter">
                <Gauge size={18} />
                {memes.length} seeds
              </div>
            </div>

            {phase === "snatch" && (
              <>
                <div className="monitor">
                  <div className="target-line"><Zap size={18} /> 捕獲ライン</div>
                  <div className="feed-lane">
                    {feed.map((meme, index) => (
                      <article key={`${meme.id}-${index}`} className={index === 0 ? "feed-card active" : "feed-card"}>
                        <div className="feed-source">{AREA_NAMES[index % AREA_NAMES.length]}</div>
                        <h2>{meme.name}</h2>
                        <p>{meme.description}</p>
                        <div className="feed-tags">
                          {(meme.tags || []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                          {meme.nsfw && <span className="danger">NSFW</span>}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
                <button className="snatch-button" onClick={handleSnatch}>
                  <Hand size={26} />
                  今だ！スナッチ
                </button>
              </>
            )}

            {phase === "scratch" && snatch && (
              <ScratchCard
                snatch={snatch}
                onReveal={(result) => {
                  setReveal(result);
                  setPhase("revealed");
                }}
              />
            )}

            {phase === "revealed" && reveal && (
              <section className="revealed-card">
                <p className="impact-copy">{reveal.message}</p>
                <h2>{reveal.meme.name}</h2>
                <p>{reveal.meme.context || reveal.meme.origin || reveal.meme.description}</p>
                <div className="detail-grid">
                  <span><strong>出現年</strong>{reveal.meme.year || "不明"}</span>
                  <span><strong>領域</strong>{reveal.meme.platform.join(" / ") || "不明"}</span>
                  <span><strong>剥離率</strong>{Math.round(reveal.revealed_ratio * 100)}%</span>
                  <span><strong>DB記録</strong>{reveal.reveal_id.slice(0, 8)}</span>
                </div>
                <button className="secondary-button" onClick={resetRun}>
                  <RefreshCcw size={18} />
                  次の激流へ
                </button>
              </section>
            )}
          </section>

          <aside className="side-stack">
            <section className="panel">
              <span className="section-title">禁断ステータス</span>
              <div className="status-grid">
                <div><Sparkles size={18} /><strong>{snatch ? "捕獲済" : "探索中"}</strong><span>snatch</span></div>
                <div><Flame size={18} /><strong>{reveal ? "開封済" : "未開封"}</strong><span>scratch</span></div>
              </div>
            </section>
            <section className="panel note-card">
              <span className="section-title">投票ログ同期</span>
              <p>公開 Google Sheets CSV を取得して、SQLite の <code>vote_logs</code> に追加します。</p>
              <button className="secondary-button sync-button" onClick={handleSyncVotes} disabled={syncingVotes}>
                <DatabaseZap size={18} />
                {syncingVotes ? "同期中..." : "Sheets同期"}
              </button>
              {voteSync && (
                <div className="sync-result">
                  <span><strong>{voteSync.fetched_rows}</strong> fetched</span>
                  <span><strong>{voteSync.inserted_rows}</strong> inserted</span>
                  <span><strong>{voteSync.total_rows}</strong> total</span>
                </div>
              )}
            </section>
            <section className="panel note-card">
              <span className="section-title">MVP方針</span>
              <p>ローカルコレクション保存は未実装。スナッチと開封結果は Rust API 経由で SQLite に残します。</p>
              <p>ミーム本体は seed JSON、投票ログは Google Sheets CSV を同期します。</p>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
