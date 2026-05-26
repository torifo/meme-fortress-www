import { useEffect, useRef, useState } from "react";

type Kind = "cannon" | "rubble";

const CONFIG: Record<Kind, { count: number; duration: number }> = {
  cannon: { count: 14, duration: 900 },
  rubble: { count: 12, duration: 900 },
};

/**
 * 押下で岩崩し / 大砲発射の粒子演出を出す button ラッパー。
 *
 * - `kind="cannon"` ... マズルフラッシュ + 大粒の放射粒子（スナッチ用）
 * - `kind="rubble"` ... 小さな瓦礫粒子（ナビ・補助ボタン用）
 *
 * 透過オーバーレイで粒子を描くため、親 button は `position: relative` 前提。
 * (`.fx-button` クラスを併用すれば自動で当たる)
 */
export function ImpactFX({ kind, active }: { kind: Kind; active: boolean }) {
  const { count, duration } = CONFIG[kind];
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  if (!active || reduced.current) return null;

  const particles = Array.from({ length: count }, (_, i) => {
    const jitter = (i * 37) % 7;
    const spin = ((i * 113) % 360) - 180;
    return (
      <span
        key={i}
        className="impact-particle"
        style={
          {
            "--i": i,
            "--total": count,
            "--jitter": jitter,
            "--spin": `${spin}deg`,
            animationDuration: `${duration}ms`,
          } as React.CSSProperties
        }
      />
    );
  });

  return (
    <span className={`impact-fx impact-fx-${kind}`} aria-hidden="true">
      <span className="impact-flash" style={{ animationDuration: `${duration * 0.5}ms` }} />
      {kind === "cannon" && (
        <span className="impact-rays" style={{ animationDuration: `${duration * 0.6}ms` }} />
      )}
      {particles}
    </span>
  );
}

/**
 * 任意のボタンに「押すと演出が走る」状態を付与するフック。
 * onClick から `trigger()` を呼ぶと、duration ms の間 active=true になり、
 * その間 ImpactFX が描画される。
 */
export function useImpactFX(kind: Kind): [boolean, () => void] {
  const [active, setActive] = useState(false);
  const timer = useRef<number | null>(null);

  const trigger = () => {
    setActive(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(false), CONFIG[kind].duration);
  };

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return [active, trigger];
}
