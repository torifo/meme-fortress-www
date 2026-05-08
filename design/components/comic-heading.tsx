"use client";

import type { ReactNode, CSSProperties } from "react";

type Variant = "burst" | "banner" | "shout";

const burstStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 40px",
  background: "var(--highlight)",
  clipPath: `polygon(
    50% 0%, 63% 15%, 80% 2%, 78% 22%, 100% 18%,
    85% 35%, 100% 50%, 85% 65%, 100% 82%,
    78% 78%, 80% 98%, 63% 85%, 50% 100%,
    37% 85%, 20% 98%, 22% 78%, 0% 82%,
    15% 65%, 0% 50%, 15% 35%, 0% 18%,
    22% 22%, 20% 2%, 37% 15%
  )`,
  transform: "rotate(-2deg)",
};

const bannerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 28px",
  background: `repeating-linear-gradient(
    -45deg,
    var(--highlight) 0px,
    var(--highlight) 6px,
    var(--highlight-light) 6px,
    var(--highlight-light) 12px
  )`,
  border: "4px solid var(--outline)",
  borderRadius: "6px",
  boxShadow: "5px 5px 0 var(--outline)",
  transform: "rotate(-1deg)",
};

const shoutStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px 24px",
  background: "#fff",
  border: "4px solid var(--outline)",
  borderRadius: "20px",
  boxShadow: "4px 4px 0 var(--outline)",
};

const STYLES: Record<Variant, CSSProperties> = {
  burst: burstStyle,
  banner: bannerStyle,
  shout: shoutStyle,
};

export function ComicHeading({
  variant,
  color,
  children,
}: {
  variant: Variant;
  color?: string;
  children: ReactNode;
}) {
  const base = STYLES[variant];
  const style = color ? { ...base, background: color } : base;

  return (
    <div style={style}>
      {children}
      {variant === "shout" && (
        <>
          <span style={{
            position: "absolute",
            bottom: -16,
            left: 30,
            width: 0,
            height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderTop: "16px solid var(--outline)",
          }} />
          <span style={{
            position: "absolute",
            bottom: -11,
            left: 32,
            width: 0,
            height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderTop: "14px solid #fff",
            zIndex: 1,
          }} />
        </>
      )}
    </div>
  );
}
