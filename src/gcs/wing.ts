import { askWing } from "./ask-wing";
import { distanceM } from "./geo";
import { emptySop, evaluateSop, type SopMemory, type WingBrief, type WingOrder } from "./pilot";
import { commandLand, commandRtl, commandTakeoff } from "./runtime";
import { useStation } from "./store";

let sopMem: SopMemory = emptySop();
let grokBusy = false;
let lastGrok = 0;

export function currentBrief(order?: string): WingBrief {
  const s = useStation.getState();
  const now = Date.now();
  return {
    inAir: s.telemetry.inAir,
    armed: s.telemetry.armed,
    locked: s.locked,
    mode: s.flightMode,
    altRel: s.telemetry.altRel,
    distM: distanceM(s.operator, s.telemetry),
    speed: s.telemetry.groundSpeed,
    climb: s.telemetry.climb,
    batteryPct: s.telemetry.batteryPct,
    sats: s.telemetry.sats,
    gpsFresh: s.operator.source === "gps" && now - s.operator.updatedAt < 4000,
    wasGps: s.operator.source === "gps",
    seatOn: s.seatOn,
    link: s.linkKind,
    linkStatus: s.linkStatus,
    operatorSpeed: s.operator.speed,
    heightM: s.follow.heightM,
    distanceM: s.follow.distanceM,
    durationS: s.flightStartedAt ? Math.max(0, (now - s.flightStartedAt) / 1000) : 0,
    order,
  };
}

export function applyWingOrder(order: WingOrder) {
  const s = useStation.getState();
  if (order.say) s.setPilotSay(order.say, order.source);
  if (order.follow) s.setFollow(order.follow);
  if (order.mode && order.mode !== s.flightMode) s.setFlightMode(order.mode);
  if (order.action === "rtl") void commandRtl();
  else if (order.action === "land") void commandLand();
  else if (order.action === "takeoff" && !s.telemetry.inAir) void commandTakeoff();
}

export function tickSop(dtMs: number) {
  const brief = currentBrief();
  const { order, mem } = evaluateSop(brief, sopMem, dtMs);
  sopMem = mem;
  if (order) applyWingOrder(order);
}

export async function consultWing(spoken?: string) {
  if (grokBusy) return;
  grokBusy = true;
  lastGrok = Date.now();
  const s = useStation.getState();
  try {
    const result = await askWing({ data: { brief: currentBrief(spoken) } });
    if (result.ok) applyWingOrder(result.order);
    else s.setPilotSay(result.error, "grok");
  } catch {
    s.setPilotSay("WING radio failed.", "grok");
  } finally {
    grokBusy = false;
  }
}

export function startWingLoop() {
  sopMem = emptySop();
  let last = performance.now();
  const sop = window.setInterval(() => {
    const now = performance.now();
    tickSop(now - last);
    last = now;
  }, 500);

  const grok = window.setInterval(() => {
    const s = useStation.getState();
    if (!s.seatOn || !s.telemetry.inAir) return;
    if (Date.now() - lastGrok < 14000) return;
    void consultWing();
  }, 15000);

  return () => {
    window.clearInterval(sop);
    window.clearInterval(grok);
  };
}
