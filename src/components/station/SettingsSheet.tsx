import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStation } from "@/gcs/store";

export function SettingsSheet() {
  const open = useStation((s) => s.settingsOpen);
  const follow = useStation((s) => s.follow);

  return (
    <Dialog.Root open={open} onOpenChange={useStation.getState().setSettingsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-bg/70" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[2010] mx-auto w-full max-w-lg rounded-t-xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] focus:outline-none sm:inset-y-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-xl font-medium tracking-tight">
                Follow geometry
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Distances the aircraft holds relative to this phone.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-4">
            <Slider
              label="Follow distance"
              unit="m"
              min={4}
              max={40}
              value={follow.distanceM}
              onChange={(v) => useStation.getState().setFollow({ distanceM: v })}
            />
            <Slider
              label="Height AGL"
              unit="m"
              min={2}
              max={80}
              value={follow.heightM}
              onChange={(v) => useStation.getState().setFollow({ heightM: v })}
            />
            <Slider
              label="Orbit radius"
              unit="m"
              min={4}
              max={50}
              value={follow.orbitRadiusM}
              onChange={(v) => useStation.getState().setFollow({ orbitRadiusM: v })}
            />
            <Slider
              label="Orbit rate"
              unit="°/s"
              min={4}
              max={30}
              value={follow.orbitRateDeg}
              onChange={(v) => useStation.getState().setFollow({ orbitRateDeg: v })}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Slider({
  label,
  unit,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular-nums text-fg">
          {value.toFixed(0)} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-accent"
      />
    </label>
  );
}
