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
