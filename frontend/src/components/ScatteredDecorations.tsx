import { Bomb, CircleAlert, Crown, Flame, Gem, Heart, Rocket, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DecoItem = {
  icon: LucideIcon;
  x: string;
  y: string;
  size: number;
  rotation: number;
  color: string;
  opacity: number;
  delay: number;
  desktopOnly?: boolean;
};

const ITEMS: DecoItem[] = [
  { icon: Star, x: "4%", y: "8%", size: 32, rotation: 15, color: "var(--highlight)", opacity: 0.55, delay: 0 },
  { icon: Bomb, x: "92%", y: "6%", size: 36, rotation: -20, color: "var(--manga-orange)", opacity: 0.6, delay: 0.3 },
  { icon: Zap, x: "90%", y: "35%", size: 28, rotation: 30, color: "var(--primary)", opacity: 0.45, delay: 0.6 },
  { icon: Heart, x: "3%", y: "45%", size: 24, rotation: -10, color: "var(--manga-pink)", opacity: 0.5, delay: 0.2 },
  { icon: Crown, x: "88%", y: "65%", size: 26, rotation: -15, color: "var(--highlight)", opacity: 0.45, delay: 0.1 },
  { icon: CircleAlert, x: "50%", y: "3%", size: 34, rotation: 8, color: "var(--primary)", opacity: 0.55, delay: 0.5 },
  { icon: Sparkles, x: "75%", y: "15%", size: 22, rotation: -25, color: "var(--secondary)", opacity: 0.45, delay: 0.7 },
  { icon: Flame, x: "8%", y: "28%", size: 28, rotation: 5, color: "var(--manga-orange)", opacity: 0.5, delay: 0.8, desktopOnly: true },
  { icon: Rocket, x: "85%", y: "82%", size: 24, rotation: 45, color: "var(--accent)", opacity: 0.4, delay: 0.15, desktopOnly: true },
  { icon: Trophy, x: "18%", y: "90%", size: 20, rotation: -8, color: "var(--highlight-deep)", opacity: 0.4, delay: 0.55, desktopOnly: true },
  { icon: Gem, x: "40%", y: "88%", size: 22, rotation: -12, color: "var(--accent-light)", opacity: 0.35, delay: 0.65, desktopOnly: true },
  { icon: Target, x: "95%", y: "50%", size: 28, rotation: 10, color: "var(--primary)", opacity: 0.45, delay: 0.25, desktopOnly: true },
];

export function ScatteredDecorations() {
  return (
    <div className="scattered-decorations" aria-hidden="true">
      {ITEMS.map((item, index) => {
        const Icon = item.icon;
        return (
          <Icon
            key={index}
            className={item.desktopOnly ? "scattered-deco-desktop" : undefined}
            size={item.size}
            color={item.color}
            strokeWidth={3}
            style={{
              left: item.x,
              top: item.y,
              opacity: item.opacity,
              animationDelay: `${item.delay}s`,
              ["--sticker-rot" as string]: `${item.rotation}deg`,
              transform: `rotate(${item.rotation}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

