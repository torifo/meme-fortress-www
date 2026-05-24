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
