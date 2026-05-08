export function CornerRibbon({
  label,
  color = "var(--primary)",
}: {
  label: string;
  color?: string;
}) {
  return (
    <span
      style={{
        position: "absolute",
        top: 12,
        right: -8,
        padding: "4px 18px 4px 12px",
        fontFamily: "var(--font-impact), var(--font-display), sans-serif",
        fontSize: "0.75rem",
        fontWeight: 400,
        color: "#fff",
        background: color,
        border: "2px solid var(--outline)",
        boxShadow: "2px 2px 0 var(--outline)",
        transform: "rotate(3deg)",
        zIndex: 10,
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
