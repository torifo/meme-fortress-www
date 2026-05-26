import { useEffect, useRef, useState } from "react";

type Direction = "ltr" | "rtl";

/**
 * タブ切替の瞬間に横方向のもやが画面を走る演出。
 * `value` は順序を持つ数値（タブ index 等）。前回より大きくなれば左→右、
 * 小さくなれば右→左にスイープする。
 */
export function PageHaze({ value }: { value: number }) {
  const [state, setState] = useState<{ playing: boolean; direction: Direction }>({
    playing: false,
    direction: "ltr",
  });
  const prev = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (prev.current === null) {
      prev.current = value;
      return;
    }
    if (prev.current === value) return;
    const direction: Direction = value > prev.current ? "ltr" : "rtl";
    prev.current = value;

    setState({ playing: false, direction });
    const raf = requestAnimationFrame(() => setState({ playing: true, direction }));
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setState((s) => ({ ...s, playing: false })),
      650,
    );
    return () => {
      cancelAnimationFrame(raf);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [value]);

  if (!state.playing) return null;
  return (
    <div className={`page-haze page-haze-${state.direction}`} aria-hidden="true">
      <span className="page-haze-blur" />
      <span className="page-haze-streak" />
    </div>
  );
}
