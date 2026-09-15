import { useEffect, useRef } from "react";
import { cameraStream } from "@/gcs/tape";
import { useStation } from "@/gcs/store";

function clock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60)
    .toString()
    .padStart(2, "0");
  const s = (t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function TapeHud() {
  const phase = useStation((s) => s.tapePhase);
  const ms = useStation((s) => s.tapeMs);
  const cam = useStation((s) => s.tapeCam);
  const mic = useStation((s) => s.tapeMic);
  const note = useStation((s) => s.tapeNote);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    const stream = cameraStream();
    if (!el || !stream || !cam) return;
    el.srcObject = stream;
    void el.play();
    return () => {
      el.srcObject = null;
    };
  }, [phase, cam]);

  if (phase === "idle") return null;

  return (
    <div className="pointer-events-none absolute left-3 top-[21.5rem] z-[620] flex flex-col gap-2">
      {cam ? (
        <video
          ref={videoRef}
          className="h-40 w-28 rounded-md object-cover shadow-[var(--shadow-border)]"
          muted
          playsInline
          autoPlay
        />
      ) : null}
      <div className="rounded-md bg-danger px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-fg">
        {phase === "arming" ? "Arming" : `Rec ${clock(ms)}`}
        <span className="mt-0.5 block text-[10px] tracking-normal text-fg/80">
          {note || (mic ? "Mic live" : "No mic")}
        </span>
      </div>
    </div>
  );
}
