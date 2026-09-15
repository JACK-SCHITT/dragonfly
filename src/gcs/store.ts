import { create } from "zustand";
import {
  DEFAULT_FOLLOW,
  DEFAULT_HOME,
  emptyTelemetry,
  type DesiredPose,
  type FlightMode,
  type FollowParams,
  type LatLng,
  type LinkKind,
  type LinkStatus,
  type LogLine,
  type Operator,
  type Phase,
  type Telemetry,
} from "./types";

const SETTINGS_KEY = "dragonfly.follow.v1";

function loadFollow(): FollowParams {
  try {
    if (typeof window === "undefined") return { ...DEFAULT_FOLLOW };
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_FOLLOW };
    const p = JSON.parse(raw) as Partial<FollowParams>;
    return {
      distanceM: clampNum(p.distanceM, 4, 40, DEFAULT_FOLLOW.distanceM),
      heightM: clampNum(p.heightM, 2, 80, DEFAULT_FOLLOW.heightM),
      orbitRadiusM: clampNum(p.orbitRadiusM, 4, 50, DEFAULT_FOLLOW.orbitRadiusM),
      orbitRateDeg: clampNum(p.orbitRateDeg, 4, 30, DEFAULT_FOLLOW.orbitRateDeg),
    };
  } catch {
    return { ...DEFAULT_FOLLOW };
  }
}

function clampNum(n: unknown, min: number, max: number, fallback: number) {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

let logSeq = 1;

export interface StationState {
  phase: Phase;
  linkKind: LinkKind;
  linkStatus: LinkStatus;
  lastHeartbeatMs: number;
  flightMode: FlightMode;
  follow: FollowParams;
  home: LatLng | null;
  telemetry: Telemetry;
  operator: Operator;
  desired: DesiredPose;
  locked: boolean;
  hoverHold: LatLng | null;
  orbitAngleDeg: number;
  logs: LogLine[];
  connectOpen: boolean;
  settingsOpen: boolean;
  stickN: number;
  stickE: number;
  takingOff: boolean;
  locationPrompted: boolean;
  locationDenied: boolean;
  serialOk: boolean;
  bluetoothOk: boolean;
  baud: number;
  flightStartedAt: number | null;

  openStation: () => void;
  setConnectOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setFlightMode: (m: FlightMode) => void;
  setFollow: (patch: Partial<FollowParams>) => void;
  setStick: (n: number, e: number) => void;
  setBaud: (n: number) => void;
  setLinkKind: (k: LinkKind) => void;
  setLinkStatus: (s: LinkStatus) => void;
  setHome: (h: LatLng | null) => void;
  setOperator: (patch: Partial<Operator>) => void;
  setTelemetry: (patch: Partial<Telemetry>) => void;
  setDesired: (d: DesiredPose) => void;
  setLocked: (v: boolean) => void;
  setHoverHold: (v: LatLng | null) => void;
  setOrbitAngle: (v: number) => void;
  setTakingOff: (v: boolean) => void;
  setLastHeartbeat: (ms: number) => void;
  setLocation: (prompted: boolean, denied: boolean) => void;
  setCapabilities: (serialOk: boolean, bluetoothOk: boolean) => void;
  setFlightStartedAt: (t: number | null) => void;
  pushLog: (text: string) => void;
  placeOperator: (lat: number, lng: number) => void;
}

export const useStation = create<StationState>((set, get) => ({
  phase: "preflight",
  linkKind: "preview",
  linkStatus: "live",
  lastHeartbeatMs: 0,
  flightMode: "follow",
  follow: loadFollow(),
  home: null,
  telemetry: emptyTelemetry(DEFAULT_HOME),
  operator: {
    lat: DEFAULT_HOME.lat,
    lng: DEFAULT_HOME.lng,
    heading: 0,
    accuracy: 0,
    speed: 0,
    source: "none",
    updatedAt: 0,
  },
  desired: { lat: DEFAULT_HOME.lat, lng: DEFAULT_HOME.lng, alt: 6, yaw: 0 },
  locked: false,
  hoverHold: null,
  orbitAngleDeg: 90,
  logs: [],
  connectOpen: false,
  settingsOpen: false,
  stickN: 0,
  stickE: 0,
  takingOff: false,
  locationPrompted: false,
  locationDenied: false,
  serialOk: false,
  bluetoothOk: false,
  baud: 57600,
  flightStartedAt: null,

  openStation: () => set({ phase: "station" }),
  setConnectOpen: (v) => set({ connectOpen: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setFlightMode: (m) => {
    const hoverHold =
      m === "hover"
        ? { lat: get().telemetry.lat, lng: get().telemetry.lng }
        : null;
    set({ flightMode: m, hoverHold });
    get().pushLog(m === "rtl" ? "Return to home" : `Mode ${m}`);
  },
  setFollow: (patch) => {
    const follow = { ...get().follow, ...patch };
    set({ follow });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(follow));
    } catch {
      /* ignore */
    }
  },
  setStick: (n, e) => set({ stickN: n, stickE: e }),
  setBaud: (n) => set({ baud: n }),
  setLinkKind: (k) => set({ linkKind: k }),
  setLinkStatus: (s) => set({ linkStatus: s }),
  setHome: (h) => set({ home: h }),
  setOperator: (patch) => set({ operator: { ...get().operator, ...patch } }),
  setTelemetry: (patch) => set({ telemetry: { ...get().telemetry, ...patch } }),
  setDesired: (d) => set({ desired: d }),
  setLocked: (v) => set({ locked: v }),
  setHoverHold: (v) => set({ hoverHold: v }),
  setOrbitAngle: (v) => set({ orbitAngleDeg: v }),
  setTakingOff: (v) => set({ takingOff: v }),
  setLastHeartbeat: (ms) => set({ lastHeartbeatMs: ms }),
  setLocation: (prompted, denied) => set({ locationPrompted: prompted, locationDenied: denied }),
  setCapabilities: (serialOk, bluetoothOk) => set({ serialOk, bluetoothOk }),
  setFlightStartedAt: (t) => set({ flightStartedAt: t }),
  pushLog: (text) => {
    const line: LogLine = { id: logSeq++, t: Date.now(), text };
    const logs = [...get().logs, line].slice(-12);
    set({ logs });
  },
  placeOperator: (lat, lng) => {
    set({
      operator: {
        ...get().operator,
        lat,
        lng,
        source: "manual",
        updatedAt: Date.now(),
      },
    });
  },
}));
