import { useState } from "react";
import { Button } from "@/components/ui/button";
import { requestLocation } from "@/gcs/runtime";
import { useStation } from "@/gcs/store";

export function Preflight() {
  const [busy, setBusy] = useState(false);
  const denied = useStation((s) => s.locationDenied);
  const prompted = useStation((s) => s.locationPrompted);

  async function openStation() {
    setBusy(true);
    try {
      await requestLocation();
    } finally {
      useStation.getState().openStation();
      useStation.getState().pushLog("Station open · preview aircraft");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col bg-bg px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Ground station</p>
        <h1 className="font-display mt-5 text-[52px] font-medium leading-[0.9] tracking-[-0.03em] text-fg">
          DRAGONFLY
        </h1>
        <p className="mt-6 max-w-[28ch] text-[17px] leading-relaxed text-muted">
          Your phone is the beacon. The aircraft locks on and stays with you.
        </p>

        <ul className="mt-10 flex flex-col gap-5 text-sm leading-relaxed text-muted">
          <li className="grid grid-cols-[4.5rem_1fr] gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Follow</span>
            <span>Holds station behind you at a set distance and height.</span>
          </li>
          <li className="grid grid-cols-[4.5rem_1fr] gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Orbit</span>
            <span>Circles you while the gimbal stays pointed in.</span>
          </li>
          <li className="grid grid-cols-[4.5rem_1fr] gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Link</span>
            <span>MAVLink over USB serial or Bluetooth. Preview aircraft until a radio is live.</span>
          </li>
          <li className="grid grid-cols-[4.5rem_1fr] gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">WING</span>
            <span>Grok in the outer loop. Procedures plus a talking copilot that flies follow, orbit, and home.</span>
          </li>
        </ul>

        <div className="mt-auto flex flex-col gap-3 pt-12">
          {prompted && denied ? (
            <p className="text-xs text-warn">
              Location is off. You can still tap the map to place the beacon.
            </p>
          ) : null}
          <Button size="lg" onClick={() => void openStation()} disabled={busy} className="w-full">
            {busy ? "Opening" : "Open station"}
          </Button>
          <p className="text-center text-xs leading-relaxed text-subtle">
            Location is used only as the follow target and never leaves this device.
          </p>
          <p className="pt-4 text-center text-[11px] leading-relaxed text-subtle">
            Concept and systems by <span className="text-muted">Johnnie Alderman</span>
            <br />
            Built with KRACKERJACK support
          </p>
        </div>
      </div>
    </main>
  );
}
