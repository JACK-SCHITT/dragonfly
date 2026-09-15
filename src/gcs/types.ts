export type LinkKind = "preview" | "serial" | "bluetooth";
export type LinkStatus = "idle" | "connecting" | "live" | "lost";
export type FlightMode = "follow" | "orbit" | "hover" | "lead" | "rtl";
export type Phase = "preflight" | "station";
export type OperatorSource = "gps" | "manual" | "none";
export type GpsFix = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface FollowParams {
  distanceM: number;
  heightM: number;
  orbitRadiusM: number;
  orbitRateDeg: number;
}

export interface Telemetry {
  lat: number;
  lng: number;
  altRel: number;
  heading: number;
  groundSpeed: number;
  climb: number;
  roll: number;
  pitch: number;
  yaw: number;
  batteryPct: number;
  batteryV: number;
  sats: number;
  gpsFix: GpsFix;
  armed: boolean;
  inAir: boolean;
  modeText: string;
  voltageMv: number;
  sysid: number;
  autopilot: string;
}

export interface Operator {
  lat: number;
  lng: number;
  heading: number;
  accuracy: number;
  speed: number;
  source: OperatorSource;
  updatedAt: number;
}

export interface DesiredPose {
  lat: number;
  lng: number;
  alt: number;
  yaw: number;
}

export interface LogLine {
  id: number;
  t: number;
  text: string;
}

export const DEFAULT_HOME: LatLng = { lat: 27.9474, lng: -82.4584 };

export const DEFAULT_FOLLOW: FollowParams = {
  distanceM: 8,
  heightM: 6,
  orbitRadiusM: 10,
  orbitRateDeg: 12,
};

export function emptyTelemetry(pos: LatLng): Telemetry {
  return {
    lat: pos.lat,
    lng: pos.lng,
    altRel: 0,
    heading: 0,
    groundSpeed: 0,
    climb: 0,
    roll: 0,
    pitch: 0,
    yaw: 0,
    batteryPct: 100,
    batteryV: 16.4,
    sats: 0,
    gpsFix: 0,
    armed: false,
    inAir: false,
    modeText: "STANDBY",
    voltageMv: 16400,
    sysid: 1,
    autopilot: "Preview",
  };
}
