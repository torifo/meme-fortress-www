export function CornerRibbon({ label, color = "var(--primary)" }: { label: string; color?: string }) {
  return (
    <span className="corner-ribbon" style={{ background: color }}>
      {label}
    </span>
  );
}

