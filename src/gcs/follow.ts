import { bearingDeg, offset, wrapDeg } from "./geo";
import type { DesiredPose, FlightMode, FollowParams, LatLng, Operator, Telemetry } from "./types";

export interface FollowInput {
  mode: FlightMode;
  operator: Operator;
  craft: Pick<Telemetry, "lat" | "lng" | "heading">;
  params: FollowParams;
  home: LatLng | null;
  hoverHold: LatLng | null;
  orbitAngleDeg: number;
}

export function computeDesired(input: FollowInput): DesiredPose {
  const { mode, operator, params, home, hoverHold, orbitAngleDeg, craft } = input;
  const you: LatLng = { lat: operator.lat, lng: operator.lng };
  const heading = operator.heading;

  if (mode === "rtl") {
    const h = home ?? you;
    return { lat: h.lat, lng: h.lng, alt: params.heightM, yaw: bearingDeg({ lat: craft.lat, lng: craft.lng }, you) };
  }

  if (mode === "hover") {
    const hold = hoverHold ?? { lat: craft.lat, lng: craft.lng };
    return {
      lat: hold.lat,
      lng: hold.lng,
      alt: params.heightM,
      yaw: bearingDeg(hold, you),
    };
  }

  if (mode === "orbit") {
    const pos = offset(you, orbitAngleDeg, params.orbitRadiusM);
    return {
      lat: pos.lat,
      lng: pos.lng,
      alt: params.heightM,
      yaw: bearingDeg(pos, you),
    };
  }

  if (mode === "lead") {
    const pos = offset(you, heading, params.distanceM);
    return {
      lat: pos.lat,
      lng: pos.lng,
      alt: params.heightM,
      yaw: wrapDeg(heading + 180),
    };
  }

  const pos = offset(you, wrapDeg(heading + 180), params.distanceM);
  return {
    lat: pos.lat,
    lng: pos.lng,
    alt: params.heightM,
    yaw: heading,
  };
}

export function isLocked(craft: LatLng, desired: DesiredPose, altRel: number, inAir: boolean) {
  if (!inAir) return false;
  const dLat = (desired.lat - craft.lat) * 111_320;
  const dLng = (desired.lng - craft.lng) * 111_320 * Math.cos((craft.lat * Math.PI) / 180);
  const horiz = Math.hypot(dLat, dLng);
  return horiz < 4 && Math.abs(altRel - desired.alt) < 2;
}
