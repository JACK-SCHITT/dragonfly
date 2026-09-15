import { useCallback, useRef } from "react";
import { useStation } from "@/gcs/store";

export function Stick() {
  const areaRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  const apply = useCallback((clientX: number, clientY: number) => {
    const el = areaRef.current;
    const knob = knobRef.current;
    if (!el || !knob) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = r.width / 2 - 18;
    const m = Math.hypot(dx, dy);
    if (m > max && m > 0) {
      dx = (dx / m) * max;
      dy = (dy / m) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const n = -dy / max;
    const e = dx / max;
    useStation.getState().setStick(n, e);
  }, []);

  const end = useCallback(() => {
    pointer.current = null;
    const knob = knobRef.current;
    if (knob) knob.style.transform = "translate(0px, 0px)";
    useStation.getState().setStick(0, 0);
  }, []);

  return (
    <div
      ref={areaRef}
      className="relative size-[112px] rounded-full bg-surface/80 shadow-[var(--shadow-border)] touch-none"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointer.current !== e.pointerId) return;
        apply(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Move beacon"
    >
      <div className="pointer-events-none absolute inset-3 rounded-full border border-border" />
      <div
        ref={knobRef}
        className="pointer-events-none absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
      />
    </div>
  );
}
