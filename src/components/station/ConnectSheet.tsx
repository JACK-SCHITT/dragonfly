import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bluetooth, Cable, Radio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIRFRAMES } from "@/gcs/airframes";
import { connectBluetooth, connectSerial, disconnectRadio } from "@/gcs/link";
import { useStation } from "@/gcs/store";
import { cn } from "@/lib/cn";

export function ConnectSheet() {
  const open = useStation((s) => s.connectOpen);
  const serialOk = useStation((s) => s.serialOk);
  const bluetoothOk = useStation((s) => s.bluetoothOk);
  const linkKind = useStation((s) => s.linkKind);
  const linkStatus = useStation((s) => s.linkStatus);
  const baud = useStation((s) => s.baud);
  const autopilot = useStation((s) => s.telemetry.autopilot);

  return (
    <Dialog.Root open={open} onOpenChange={useStation.getState().setConnectOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-bg/70" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[2010] mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-xl bg-surface shadow-[var(--shadow-border)] focus:outline-none sm:inset-y-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(88dvh,40rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <Dialog.Title className="font-display text-xl font-medium tracking-tight">
                Aircraft link
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Live radio is MAVLink. Everything else is catalogued so Johnnie can wire the next adapter.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="shrink-0">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-col gap-2">
              <LinkRow
                icon={<Radio className="size-4" />}
                title="Preview aircraft"
                body="On-device twin. Uses this phone as the beacon so you can rehearse follow, orbit, and return."
                active={linkKind === "preview"}
                actionLabel={linkKind === "preview" ? "Active" : "Use preview"}
                onAction={() => {
                  void disconnectRadio();
                  useStation.getState().setConnectOpen(false);
                }}
              />
              <LinkRow
                icon={<Cable className="size-4" />}
                title="USB serial"
                body={
                  serialOk
                    ? "Pixhawk, Cube, or USB telemetry radio. Baud 57600 is typical for SiK; 115200 for many USB FC boards."
                    : "Needs Chrome or Edge on desktop. Safari and iPhone cannot open serial ports."
                }
                disabled={!serialOk}
                active={linkKind === "serial"}
                actionLabel={linkStatus === "connecting" && linkKind === "serial" ? "Opening" : "Connect"}
                onAction={async () => {
                  try {
                    await connectSerial(useStation.getState().baud);
                    useStation.getState().setConnectOpen(false);
                  } catch (err) {
                    useStation.getState().pushLog(err instanceof Error ? err.message : "Serial failed");
                  }
                }}
              />
              {serialOk ? (
                <label className="flex items-center justify-between gap-3 rounded-md bg-raised px-3 py-2 text-sm text-muted">
                  Baud
                  <select
                    className="h-9 rounded-sm bg-surface px-2 font-mono text-fg shadow-[var(--shadow-border)]"
                    value={baud}
                    onChange={(e) => useStation.getState().setBaud(Number(e.target.value))}
                  >
                    <option value={57600}>57600</option>
                    <option value={115200}>115200</option>
                    <option value={921600}>921600</option>
                  </select>
                </label>
              ) : null}
              <LinkRow
                icon={<Bluetooth className="size-4" />}
                title="Bluetooth telemetry"
                body={
                  bluetoothOk
                    ? "Nordic UART (NUS) BLE modules — common on SiK-style Bluetooth radios. Android Chrome."
                    : "Needs Android Chrome. iPhone Safari blocks Web Bluetooth."
                }
                disabled={!bluetoothOk}
                active={linkKind === "bluetooth"}
                actionLabel="Pair"
                onAction={async () => {
                  try {
                    await connectBluetooth();
                    useStation.getState().setConnectOpen(false);
                  } catch (err) {
                    useStation.getState().pushLog(err instanceof Error ? err.message : "Bluetooth failed");
                  }
                }}
              />
            </div>

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">Airframes</p>
            <ul className="mt-2 flex flex-col gap-2">
              {AIRFRAMES.map((a) => (
                <li key={a.id} className="rounded-lg bg-raised p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{a.name}</p>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[10px] uppercase tracking-[0.12em]",
                        a.path === "live" ? "text-ok" : a.path === "closed" ? "text-danger" : "text-warn",
                      )}
                    >
                      {a.pathLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{a.models}</p>
                  <p className="mt-2 text-xs leading-relaxed text-subtle">{a.how}</p>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs leading-relaxed text-subtle">
              {autopilot && linkKind !== "preview" ? `Listening for ${autopilot}. ` : null}
              Full protocol notes live in the repo as DRONES.md. Concept by Johnnie Alderman.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LinkRow({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  active,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-raised p-3">
      <div className="mt-0.5 text-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {active ? <span className="text-[10px] uppercase tracking-[0.14em] text-ok">Linked</span> : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
      </div>
      <Button
        size="sm"
        variant={active ? "secondary" : "primary"}
        disabled={disabled || active}
        onClick={onAction}
        className="shrink-0"
      >
        {actionLabel}
      </Button>
    </div>
  );
}
