import { useEffect, type ReactNode } from "react";
import {
  BatteryMedium,
  Crosshair,
  Headphones,
  Home,
  Radio,
  Satellite,
  Settings2,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectSheet } from "@/components/station/ConnectSheet";
import { MapView } from "@/components/station/MapView";
import { Pfd } from "@/components/station/Pfd";
import { PilotSheet } from "@/components/station/PilotSheet";
import { SettingsSheet } from "@/components/station/SettingsSheet";
import { ShareSheet } from "@/components/station/ShareSheet";
import { Stick } from "@/components/station/Stick";
import { commandLand, commandRtl, commandTakeoff, startRuntime } from "@/gcs/runtime";
import { startWingLoop } from "@/gcs/wing";
import { distanceM, pad } from "@/gcs/geo";
import { useStation } from "@/gcs/store";
import type { FlightMode } from "@/gcs/types";
import { cn } from "@/lib/cn";

const MODES: { id: FlightMode; label: string }[] = [
  { id: "follow", label: "Follow" },
  { id: "orbit", label: "Orbit" },
  { id: "hover", label: "Hover" },
  { id: "lead", label: "Lead" },
];

export function Station() {
  useEffect(() => {
    const stopRuntime = startRuntime();
    const stopWing = startWingLoop();
    return () => {
      stopRuntime();
      stopWing();
    };
  }, []);

  const linkKind = useStation((s) => s.linkKind);
  const linkStatus = useStation((s) => s.linkStatus);
  const tel = useStation((s) => s.telemetry);
  const operator = useStation((s) => s.operator);
  const locked = useStation((s) => s.locked);
  const mode = useStation((s) => s.flightMode);
  const logs = useStation((s) => s.logs);
  const seatOn = useStation((s) => s.seatOn);
  const pilotSay = useStation((s) => s.pilotSay);
  const inAir = tel.inAir;
  const dist = distanceM(operator, tel);

  return (
    <main className="relative h-dvh overflow-hidden bg-bg text-fg">
      <MapView />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex items-start justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto rounded-lg bg-surface/90 px-3 py-2 shadow-[var(--shadow-border)]">
          <p className="font-display text-lg font-medium leading-none tracking-tight">DRAGONFLY</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {linkKind === "preview" ? "Preview aircraft" : tel.autopilot} · {linkStatus}
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg bg-surface/90 p-1 shadow-[var(--shadow-border)]">
          <IconChip
            icon={<Radio className="size-3.5" />}
            ok={linkStatus === "live"}
            label={linkStatus === "live" ? "LINK" : "NO LINK"}
          />
          <IconChip
            icon={<Satellite className="size-3.5" />}
            ok={tel.gpsFix >= 3 || operator.source === "gps"}
            label={tel.sats > 0 ? `${tel.sats} SAT` : operator.source === "gps" ? "PHONE" : "NO GPS"}
          />
          <IconChip
            icon={<BatteryMedium className="size-3.5" />}
            ok={tel.batteryPct > 20}
            warn={tel.batteryPct <= 20 && tel.batteryPct > 10}
            label={`${Math.round(tel.batteryPct)}%`}
          />
        </div>
      </header>

      <div className="pointer-events-none absolute left-3 top-24 z-[600] flex flex-col gap-2">
        <div className="pointer-events-auto rounded-lg bg-surface/90 p-2 shadow-[var(--shadow-border)]">
          <Pfd className="block h-[112px] w-[112px]" />
        </div>
        <div className="rounded-md bg-surface/90 px-2.5 py-2 font-mono text-[11px] tabular-nums leading-5 shadow-[var(--shadow-border)]">
          <Row k="ALT" v={`${pad(tel.altRel, 1)} m`} />
          <Row k="SPD" v={`${pad(tel.groundSpeed, 1)} m/s`} />
          <Row k="DST" v={`${pad(dist, 1)} m`} />
          <Row k="HDG" v={`${Math.round(tel.heading).toString().padStart(3, "0")}°`} />
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 top-24 z-[600] flex flex-col items-end gap-2">
        <div
          className={cn(
            "rounded-md px-3 py-2 text-right shadow-[var(--shadow-border)]",
            locked ? "bg-ok text-bg" : "bg-surface/90 text-muted",
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em]">
            {locked ? "Locked on you" : inAir ? "Acquiring" : "On deck"}
          </p>
          <p className="mt-0.5 text-xs">{tel.modeText}</p>
        </div>
        {pilotSay ? (
          <p
            className={cn(
              "max-w-[16rem] rounded-md px-2.5 py-1.5 text-right text-[11px] leading-relaxed",
              seatOn ? "bg-surface/90 text-fg" : "bg-surface/80 text-muted",
            )}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-subtle">
              {seatOn ? "WING" : "CALL"}
            </span>
            <br />
            {pilotSay}
          </p>
        ) : logs.length ? (
          <p className="max-w-[16rem] rounded-md bg-surface/80 px-2.5 py-1.5 text-right text-[11px] text-muted">
            {logs[logs.length - 1]?.text}
          </p>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[600] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-lg flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <Stick />
            <div className="flex flex-col gap-2">
              <Button
                variant={seatOn ? "primary" : "secondary"}
                size="icon"
                aria-label="WING"
                onClick={() => useStation.getState().setPilotOpen(true)}
              >
                <Headphones className="size-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Aircraft link"
                onClick={() => useStation.getState().setConnectOpen(true)}
              >
                <Radio className="size-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Post"
                onClick={() => useStation.getState().setShareOpen(true)}
              >
                <Share2 className="size-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Follow settings"
                onClick={() => useStation.getState().setSettingsOpen(true)}
              >
                <Settings2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex rounded-lg bg-surface/90 p-1 shadow-[var(--shadow-border)]">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => useStation.getState().setFlightMode(m.id)}
                className={cn(
                  "h-11 flex-1 rounded-md text-sm font-medium",
                  mode === m.id ? "bg-raised text-fg" : "text-muted",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              className="h-12"
              onClick={() => void commandRtl()}
              disabled={!inAir && !tel.armed}
            >
              <Home className="size-4" />
              Return
            </Button>
            {inAir ? (
              <Button variant="secondary" className="h-12" onClick={() => void commandLand()}>
                Land
              </Button>
            ) : (
              <Button className="h-12" onClick={() => void commandTakeoff()}>
                <Crosshair className="size-4" />
                Takeoff
              </Button>
            )}
            <Button
              variant="ghost"
              className="h-12 bg-raised"
              onClick={() => useStation.getState().setConnectOpen(true)}
            >
              {linkKind === "preview" ? "Connect" : "Link"}
            </Button>
          </div>
          <p className="text-center text-[11px] text-subtle">
            {operator.source === "gps"
              ? "Phone GPS is the beacon"
              : "Tap the map or use the stick to move the beacon · WASD on desktop"}
          </p>
        </div>
      </div>

      <ConnectSheet />
      <SettingsSheet />
      <ShareSheet />
      <PilotSheet />
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-subtle">{k}</span>
      <span className="text-fg">{v}</span>
    </div>
  );
}

function IconChip({
  icon,
  label,
  ok,
  warn,
}: {
  icon: ReactNode;
  label: string;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-sm px-2 font-mono text-[10px] uppercase tracking-[0.08em]",
        warn ? "text-warn" : ok ? "text-ok" : "text-danger",
      )}
    >
      {icon}
      {label}
    </span>
  );
}
