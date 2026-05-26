import { useEffect, useRef, useState } from "react";

/**
 * タブ切替の瞬間に横方向のもやが画面を走る演出。
 * 任意の依存値（通常は現在ページ名）を渡すと、その値が変わるたびに
 * 1 回だけ 600ms の sweep を再生する。
 */
export function PageHaze({ trigger }: { trigger: unknown }) {
  const [playing, setPlaying] = useState(false);
  const first = useRef(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPlaying(false);
    // 次フレームで true にして再アニメーションを確実に発火
    const raf = requestAnimationFrame(() => setPlaying(true));
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(false), 650);
    return () => {
      cancelAnimationFrame(raf);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [trigger]);

  if (!playing) return null;
  return (
    <div className="page-haze" aria-hidden="true">
      <span className="page-haze-blur" />
      <span className="page-haze-streak" />
    </div>
  );
}
