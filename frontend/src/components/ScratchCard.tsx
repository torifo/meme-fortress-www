import { useEffect, useRef, useState } from "react";
import { createReveal } from "../api";
import type { RevealResponse, SnatchResponse } from "../types";

export function ScratchCard({
  snatch,
  onReveal,
}: {
  snatch: SnatchResponse;
  onReveal: (result: RevealResponse) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ratio, setRatio] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const doneRef = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * scale);
    canvas.height = Math.floor(rect.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#b8bcc5";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#eef0f5";
    ctx.font = "900 24px 'Noto Sans JP', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("禁断の銀はがし", rect.width / 2, rect.height / 2 - 8);
    ctx.font = "700 14px 'Noto Sans JP', sans-serif";
    ctx.fillText("こすれ！カリカリカリ！", rect.width / 2, rect.height / 2 + 22);
  }, [snatch.snatch_id]);

  // コインの接地エッジを模した楕円ブラシ。
  // 長軸を ╲（左上→右下, 45deg）に固定する。
  // → ╱方向（右上→左下）に動かすと長辺を横に掃くため削れる面積が最大、
  //   ╲方向（左上→右下）に動かすと薄い辺をなぞるため面積が最小になる。
  const COIN_LONG = 38;
  const COIN_SHORT = 8;
  const COIN_ANGLE = Math.PI / 4;

  const stampCoin = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, COIN_LONG, COIN_SHORT, COIN_ANGLE, 0, Math.PI * 2);
    ctx.fill();
  };

  const scratch = async (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || doneRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.globalCompositeOperation = "destination-out";

    // 前回位置との間を補間して連続したストロークにする（楕円が薄いため隙間防止）
    const last = lastPos.current;
    if (last) {
      const dist = Math.hypot(x - last.x, y - last.y);
      const steps = Math.max(1, Math.ceil(dist / 3));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        stampCoin(ctx, last.x + (x - last.x) * t, last.y + (y - last.y) * t);
      }
    } else {
      stampCoin(ctx, x, y);
    }
    lastPos.current = { x, y };

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let cleared = 0;
    for (let i = 3; i < image.data.length; i += 16) {
      if (image.data[i] === 0) cleared += 1;
    }
    const nextRatio = Math.min(cleared / (image.data.length / 16), 1);
    setRatio(nextRatio);

    if (nextRatio > 0.66 && !doneRef.current) {
      doneRef.current = true;
      setIsRevealing(true);
      const result = await createReveal(snatch.snatch_id, nextRatio);
      onReveal(result);
    }
  };

  return (
    <section className="scratch-stage">
      <div className="postcard">
        <div className="postcard-top">
          <span>{snatch.postcard_code}</span>
          <strong>未開封・銀はがしポストカード</strong>
        </div>
        <div className="secret-content">
          <p className="secret-kicker">衝撃の核心</p>
          <h2>{snatch.meme.name}</h2>
          <p>{snatch.meme.description}</p>
          <div className="secret-meta">
            <span>{snatch.meme.era || "時代不明"}</span>
            <span>{snatch.meme.year || "????"}</span>
            {snatch.meme.nsfw && <span className="danger">禁断</span>}
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="scratch-canvas"
          onPointerDown={(event) => {
            lastPos.current = null;
            scratch(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) scratch(event.clientX, event.clientY);
          }}
          onPointerUp={() => {
            lastPos.current = null;
          }}
          onPointerLeave={() => {
            lastPos.current = null;
          }}
        />
      </div>
      <div className="scratch-meter">
        <span>剥離率</span>
        <strong>{Math.round(ratio * 100)}%</strong>
        <div><i style={{ width: `${ratio * 100}%` }} /></div>
      </div>
      {isRevealing && <p className="impact-copy">ズババババ！開封ログを SQLite に刻印中！</p>}
    </section>
  );
}

