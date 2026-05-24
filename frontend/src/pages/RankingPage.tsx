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
