import type { FlightMode, FollowParams } from "./types";

export type WingAction = "none" | "takeoff" | "land" | "rtl";
export type WingSource = "sop" | "grok" | "idle";

export interface WingOrder {
  say: string;
  mode: FlightMode | null;
  follow: Partial<FollowParams> | null;
  action: WingAction;
  source: WingSource;
}

export interface WingBrief {
  inAir: boolean;
  armed: boolean;
  locked: boolean;
  mode: FlightMode;
  altRel: number;
  distM: number;
  speed: number;
  climb: number;
  batteryPct: number;
  sats: number;
  gpsFresh: boolean;
  wasGps: boolean;
  seatOn: boolean;
  link: string;
  linkStatus: string;
  operatorSpeed: number;
  heightM: number;
  distanceM: number;
  durationS: number;
  order?: string;
}

export interface SopMemory {
  lastKey: string;
  lockSaid: boolean;
  stillMs: number;
}

export function emptySop(): SopMemory {
  return { lastKey: "", lockSaid: false, stillMs: 0 };
}

export function evaluateSop(brief: WingBrief, mem: SopMemory, dtMs: number): { order: WingOrder | null; mem: SopMemory } {
  const next = { ...mem };

  if (brief.inAir && brief.batteryPct > 0 && brief.batteryPct <= 18) {
    return emit("battery-rtl", next, {
      say: "Battery thin. Returning home.",
      mode: "rtl",
      follow: null,
      action: "rtl",
      source: "sop",
    });
  }

  if (brief.inAir && brief.linkStatus === "lost") {
    if (brief.mode !== "hover") {
      return emit("lost-hover", next, {
        say: "Link lost. Holding hover.",
        mode: "hover",
        follow: null,
        action: "none",
        source: "sop",
      });
    }
  }

  if (brief.inAir && brief.wasGps && !brief.gpsFresh) {
    if (brief.mode !== "hover" && brief.mode !== "rtl") {
      return emit("gps-hover", next, {
        say: "Phone GPS stale. Holding hover.",
        mode: "hover",
        follow: null,
        action: "none",
        source: "sop",
      });
    }
  }

  if (!brief.seatOn) return { order: null, mem: next };

  if (brief.inAir && brief.locked && !next.lockSaid) {
    next.lockSaid = true;
    return emit("lock", next, {
      say: "Locked on you. Holding station.",
      mode: null,
      follow: null,
      action: "none",
      source: "sop",
    });
  }

  if (!brief.inAir) {
    next.lockSaid = false;
    next.stillMs = 0;
  } else if (brief.operatorSpeed < 0.4) {
    next.stillMs += dtMs;
  } else {
    next.stillMs = 0;
  }

  if (brief.inAir && brief.locked && next.stillMs > 14000 && brief.mode === "follow") {
    return emit("still-orbit", next, {
      say: "You stopped. Orbiting for the shot.",
      mode: "orbit",
      follow: null,
      action: "none",
      source: "sop",
    });
  }

  if (brief.inAir && brief.operatorSpeed > 1.6 && brief.mode === "orbit") {
    return emit("walk-follow", next, {
      say: "You're moving. Back to follow.",
      mode: "follow",
      follow: null,
      action: "none",
      source: "sop",
    });
  }

  return { order: null, mem: next };
}

function emit(key: string, mem: SopMemory, order: WingOrder) {
  if (mem.lastKey === key) return { order: null, mem };
  return { order, mem: { ...mem, lastKey: key } };
}

export function parseWingJson(raw: string): WingOrder | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Partial<WingOrder> & { say?: string };
    const mode = validMode(j.mode);
    const action = validAction(j.action);
    const follow = validFollow(j.follow);
    const say = typeof j.say === "string" ? j.say.trim().slice(0, 120) : "";
    if (!say && !mode && action === "none" && !follow) return null;
    return { say, mode, follow, action, source: "grok" };
  } catch {
    return null;
  }
}

function validMode(m: unknown): FlightMode | null {
  if (m === "follow" || m === "orbit" || m === "hover" || m === "lead" || m === "rtl") return m;
  return null;
}

function validAction(a: unknown): WingAction {
  if (a === "takeoff" || a === "land" || a === "rtl") return a;
  return "none";
}

function validFollow(f: unknown): Partial<FollowParams> | null {
  if (!f || typeof f !== "object") return null;
  const o = f as Record<string, unknown>;
  const out: Partial<FollowParams> = {};
  if (typeof o.distanceM === "number") out.distanceM = o.distanceM;
  if (typeof o.heightM === "number") out.heightM = o.heightM;
  if (typeof o.orbitRadiusM === "number") out.orbitRadiusM = o.orbitRadiusM;
  if (typeof o.orbitRateDeg === "number") out.orbitRateDeg = o.orbitRateDeg;
  return Object.keys(out).length ? out : null;
}
