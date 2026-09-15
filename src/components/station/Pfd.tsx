import { useEffect, useRef } from "react";
import { useStation } from "@/gcs/store";

export function Pfd({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const css = getComputedStyle(document.documentElement);
    const fg = css.getPropertyValue("--color-fg").trim() || "#e8eeea";
    const muted = css.getPropertyValue("--color-muted").trim() || "#8b968f";
    const sky = "#15221c";
    const ground = "#0c100e";

    const draw = () => {
      const t = useStation.getState().telemetry;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2 - 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      const pitchPx = t.pitch * (180 / Math.PI) * 2.2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t.roll);
      ctx.translate(0, pitchPx);
      ctx.fillStyle = sky;
      ctx.fillRect(-w, -h * 2, w * 2, h * 2);
      ctx.fillStyle = ground;
      ctx.fillRect(-w, 0, w * 2, h * 2);
      ctx.strokeStyle = "rgba(232,238,234,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.lineTo(w, 0);
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.font = "500 9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      for (const deg of [-20, -10, 10, 20]) {
        const y = -deg * 2.2;
        ctx.fillRect(-18, y, 36, 1);
        ctx.fillText(`${Math.abs(deg)}`, 0, y - 3);
      }
      ctx.restore();

      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy);
      ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 8, cy);
      ctx.lineTo(cx + 28, cy);
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx, cy + 6);
      ctx.lineTo(cx + 8, cy);
      ctx.stroke();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "rgba(232,238,234,0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = muted;
      ctx.font = "500 10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(((t.heading % 360) + 360) % 360).toString().padStart(3, "0")}°`, cx, h - 8);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Attitude indicator"
    />
  );
}
