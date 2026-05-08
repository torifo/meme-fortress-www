"use client";

import { useMemo } from "react";
import {
  Star, Sparkles, Zap, Heart, Flame, Rocket,
  Crown, Trophy, Gem, PartyPopper, Bomb, MessageCircle,
  Swords, Medal, CircleAlert, Gift, Target, Lightbulb,
  BarChart3, Dice6,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DecorationPreset = "home" | "login" | "dashboard" | "insights";

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

const PRESETS: Record<DecorationPreset, DecoItem[]> = {
  home: [
    { icon: Star, x: "4%", y: "8%", size: 32, rotation: 15, color: "var(--highlight)", opacity: 0.55, delay: 0 },
    { icon: Bomb, x: "92%", y: "6%", size: 36, rotation: -20, color: "var(--manga-orange)", opacity: 0.6, delay: 0.3 },
    { icon: Zap, x: "90%", y: "35%", size: 28, rotation: 30, color: "var(--primary)", opacity: 0.45, delay: 0.6 },
    { icon: Heart, x: "3%", y: "45%", size: 24, rotation: -10, color: "var(--manga-pink)", opacity: 0.5, delay: 0.2 },
    { icon: Star, x: "14%", y: "72%", size: 30, rotation: 12, color: "var(--highlight)", opacity: 0.5, delay: 0.4 },
    { icon: Crown, x: "88%", y: "65%", size: 26, rotation: -15, color: "var(--highlight)", opacity: 0.45, delay: 0.1 },
    { icon: CircleAlert, x: "50%", y: "3%", size: 34, rotation: 8, color: "var(--primary)", opacity: 0.55, delay: 0.5 },
    { icon: Sparkles, x: "75%", y: "15%", size: 22, rotation: -25, color: "var(--secondary)", opacity: 0.45, delay: 0.7 },
    { icon: Flame, x: "8%", y: "28%", size: 28, rotation: 5, color: "var(--manga-orange)", opacity: 0.5, delay: 0.8, desktopOnly: true },
    { icon: Rocket, x: "85%", y: "82%", size: 24, rotation: 45, color: "var(--accent)", opacity: 0.4, delay: 0.15, desktopOnly: true },
    { icon: Trophy, x: "18%", y: "90%", size: 20, rotation: -8, color: "var(--highlight-deep)", opacity: 0.4, delay: 0.55, desktopOnly: true },
    { icon: Sparkles, x: "65%", y: "48%", size: 26, rotation: 20, color: "var(--secondary)", opacity: 0.4, delay: 0.35, desktopOnly: true },
    { icon: Gem, x: "40%", y: "88%", size: 22, rotation: -12, color: "var(--accent-light)", opacity: 0.35, delay: 0.65, desktopOnly: true },
    { icon: Target, x: "95%", y: "50%", size: 28, rotation: 10, color: "var(--primary)", opacity: 0.45, delay: 0.25, desktopOnly: true },
  ],
  login: [
    { icon: Star, x: "6%", y: "10%", size: 34, rotation: 20, color: "var(--highlight)", opacity: 0.6, delay: 0 },
    { icon: Star, x: "90%", y: "12%", size: 38, rotation: -15, color: "var(--highlight-deep)", opacity: 0.6, delay: 0.2 },
    { icon: Heart, x: "5%", y: "75%", size: 28, rotation: 10, color: "var(--manga-pink)", opacity: 0.5, delay: 0.4 },
    { icon: Bomb, x: "88%", y: "70%", size: 32, rotation: -25, color: "var(--manga-orange)", opacity: 0.55, delay: 0.6 },
    { icon: Sparkles, x: "15%", y: "40%", size: 24, rotation: -10, color: "var(--secondary)", opacity: 0.45, delay: 0.3 },
    { icon: PartyPopper, x: "85%", y: "40%", size: 26, rotation: 15, color: "var(--accent)", opacity: 0.45, delay: 0.5 },
    { icon: PartyPopper, x: "50%", y: "5%", size: 30, rotation: 5, color: "var(--secondary)", opacity: 0.5, delay: 0.1 },
    { icon: Gift, x: "92%", y: "88%", size: 22, rotation: -20, color: "var(--primary)", opacity: 0.4, delay: 0.7 },
    { icon: Sparkles, x: "8%", y: "88%", size: 26, rotation: 8, color: "var(--secondary)", opacity: 0.45, delay: 0.35, desktopOnly: true },
    { icon: Zap, x: "78%", y: "22%", size: 20, rotation: 30, color: "var(--highlight-deep)", opacity: 0.4, delay: 0.45, desktopOnly: true },
    { icon: CircleAlert, x: "30%", y: "92%", size: 28, rotation: -8, color: "var(--primary)", opacity: 0.5, delay: 0.55, desktopOnly: true },
    { icon: Crown, x: "70%", y: "90%", size: 24, rotation: 12, color: "var(--highlight)", opacity: 0.4, delay: 0.65, desktopOnly: true },
  ],
  dashboard: [
    { icon: Swords, x: "5%", y: "6%", size: 30, rotation: 25, color: "var(--primary)", opacity: 0.5, delay: 0 },
    { icon: Flame, x: "92%", y: "8%", size: 34, rotation: -18, color: "var(--manga-orange)", opacity: 0.6, delay: 0.3 },
    { icon: Bomb, x: "88%", y: "40%", size: 26, rotation: 15, color: "var(--manga-orange)", opacity: 0.45, delay: 0.5 },
    { icon: Star, x: "4%", y: "50%", size: 28, rotation: -10, color: "var(--highlight)", opacity: 0.5, delay: 0.2 },
    { icon: Bomb, x: "10%", y: "80%", size: 32, rotation: 12, color: "var(--primary)", opacity: 0.55, delay: 0.4 },
    { icon: Flame, x: "90%", y: "72%", size: 24, rotation: -22, color: "var(--primary)", opacity: 0.45, delay: 0.6 },
    { icon: Zap, x: "50%", y: "4%", size: 30, rotation: 8, color: "var(--highlight)", opacity: 0.55, delay: 0.15 },
    { icon: Medal, x: "82%", y: "90%", size: 22, rotation: -5, color: "var(--highlight-deep)", opacity: 0.4, delay: 0.7 },
    { icon: Trophy, x: "15%", y: "25%", size: 24, rotation: 18, color: "var(--accent)", opacity: 0.4, delay: 0.35, desktopOnly: true },
    { icon: Dice6, x: "75%", y: "55%", size: 28, rotation: -12, color: "var(--accent)", opacity: 0.45, delay: 0.45, desktopOnly: true },
    { icon: Sparkles, x: "35%", y: "90%", size: 20, rotation: 22, color: "var(--secondary)", opacity: 0.35, delay: 0.55, desktopOnly: true },
    { icon: Sparkles, x: "95%", y: "25%", size: 26, rotation: -8, color: "var(--secondary)", opacity: 0.4, delay: 0.25, desktopOnly: true },
    { icon: Zap, x: "60%", y: "92%", size: 22, rotation: 35, color: "var(--manga-cyan)", opacity: 0.35, delay: 0.75, desktopOnly: true },
  ],
  insights: [
    { icon: Star, x: "5%", y: "10%", size: 28, rotation: 12, color: "var(--highlight)", opacity: 0.5, delay: 0 },
    { icon: BarChart3, x: "90%", y: "8%", size: 30, rotation: -15, color: "var(--accent)", opacity: 0.55, delay: 0.3 },
    { icon: Gem, x: "88%", y: "45%", size: 24, rotation: 20, color: "var(--accent-light)", opacity: 0.45, delay: 0.5 },
    { icon: Crown, x: "4%", y: "55%", size: 26, rotation: -8, color: "var(--highlight)", opacity: 0.5, delay: 0.2 },
    { icon: Star, x: "12%", y: "80%", size: 28, rotation: 10, color: "var(--highlight-deep)", opacity: 0.5, delay: 0.4 },
    { icon: Trophy, x: "85%", y: "75%", size: 22, rotation: -20, color: "var(--highlight-deep)", opacity: 0.4, delay: 0.6 },
    { icon: Sparkles, x: "50%", y: "3%", size: 26, rotation: 5, color: "var(--secondary)", opacity: 0.5, delay: 0.15 },
    { icon: Sparkles, x: "92%", y: "90%", size: 20, rotation: 15, color: "var(--secondary)", opacity: 0.4, delay: 0.7 },
    { icon: Heart, x: "8%", y: "30%", size: 22, rotation: -12, color: "var(--manga-pink)", opacity: 0.4, delay: 0.35, desktopOnly: true },
    { icon: Lightbulb, x: "78%", y: "25%", size: 24, rotation: 8, color: "var(--highlight)", opacity: 0.45, delay: 0.45, desktopOnly: true },
    { icon: MessageCircle, x: "30%", y: "88%", size: 20, rotation: -18, color: "var(--manga-blue)", opacity: 0.35, delay: 0.55, desktopOnly: true },
    { icon: Target, x: "70%", y: "60%", size: 24, rotation: 22, color: "var(--primary)", opacity: 0.4, delay: 0.65, desktopOnly: true },
  ],
};

export function ScatteredDecorations({ preset }: { preset: DecorationPreset }) {
  const items = useMemo(() => PRESETS[preset], [preset]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
        overflow: "hidden",
      }}
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <Icon
            key={i}
            className={item.desktopOnly ? "scattered-deco-desktop" : undefined}
            size={item.size}
            color={item.color}
            strokeWidth={3}
            style={{
              position: "absolute",
              left: item.x,
              top: item.y,
              opacity: item.opacity,
              animation: `stickerFloat 3s ease-in-out ${item.delay}s infinite`,
              ["--sticker-rot" as string]: `${item.rotation}deg`,
              transform: `rotate(${item.rotation}deg)`,
              willChange: "transform",
            }}
          />
        );
      })}
    </div>
  );
}
