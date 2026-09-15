import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { consultWing } from "@/gcs/wing";
import { useStation } from "@/gcs/store";
import { cn } from "@/lib/cn";

const CALLS = ["Orbit me", "Stay closer", "Climb to 12 m", "Hold", "Come home"];

export function PilotSheet() {
  const open = useStation((s) => s.pilotOpen);
  const seatOn = useStation((s) => s.seatOn);
  const say = useStation((s) => s.pilotSay);
  const source = useStation((s) => s.pilotSource);
  const inAir = useStation((s) => s.telemetry.inAir);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function talk(order: string) {
    const spoken = order.trim();
    if (!spoken) return;
    setBusy(true);
    try {
      if (!seatOn) useStation.getState().setSeatOn(true);
      await consultWing(spoken);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={useStation.getState().setPilotOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-bg/70" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[2010] mx-auto w-full max-w-lg rounded-t-xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] focus:outline-none sm:inset-y-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-xl font-medium tracking-tight">
                WING
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Grok 4.5 in the outer loop. The flight controller still flies attitude. WING chooses follow, orbit, lead, and home.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <button
            type="button"
            onClick={() => useStation.getState().setSeatOn(!seatOn)}
            className={cn(
              "flex h-12 w-full items-center justify-between rounded-lg px-4 text-sm font-medium",
              seatOn ? "bg-ok text-bg" : "bg-raised text-fg",
            )}
          >
            <span>{seatOn ? "Seat occupied" : "Seat empty"}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
              {seatOn ? "WING" : "YOU"}
            </span>
          </button>

          <p className="mt-4 min-h-10 text-sm leading-relaxed text-fg">
            {say || "No call yet."}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
            {source === "idle" ? "—" : source === "sop" ? "Procedures" : "Grok"}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {CALLS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={busy}
                onClick={() => void talk(c)}
                className="h-10 rounded-sm bg-raised px-3 text-xs text-muted"
              >
                {c}
              </button>
            ))}
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void talk(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={inAir ? "Tell WING what to fly" : "Takeoff first, then talk"}
              className="h-11 flex-1 rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            />
            <Button type="submit" disabled={busy || !text.trim()} className="h-11">
              {busy ? "…" : "Say"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
