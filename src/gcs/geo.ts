import type { LatLng } from "./types";

export const EARTH_M = 6371000;

export function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

export function wrapDeg(deg: number) {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

export function shortestDeg(from: number, to: number) {
  let d = wrapDeg(to) - wrapDeg(from);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function lerpAngleDeg(from: number, to: number, t: number) {
  return wrapDeg(from + shortestDeg(from, to) * t);
}

export function offset(origin: LatLng, headingDeg: number, distanceM: number): LatLng {
  const d = distanceM / EARTH_M;
  const h = toRad(headingDeg);
  const lat1 = toRad(origin.lat);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(h),
  );
  const lng2 =
    toRad(origin.lng) +
    Math.atan2(
      Math.sin(h) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

export function distanceM(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(from: LatLng, to: LatLng) {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return wrapDeg(toDeg(Math.atan2(y, x)));
}

export function moveNorthEast(origin: LatLng, northM: number, eastM: number): LatLng {
  const dist = Math.hypot(northM, eastM);
  if (dist < 1e-6) return origin;
  const heading = wrapDeg(toDeg(Math.atan2(eastM, northM)));
  return offset(origin, heading, dist);
}

export function pad(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function padInt(n: number) {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toString();
}
