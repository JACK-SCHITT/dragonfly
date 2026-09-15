export type MapKind = "sat" | "street";

const KEY = "dragonfly.map.v1";

export function loadMapKind(): MapKind {
  try {
    if (typeof window === "undefined") return "sat";
    return localStorage.getItem(KEY) === "street" ? "street" : "sat";
  } catch {
    return "sat";
  }
}

export function saveMapKind(kind: MapKind) {
  try {
    localStorage.setItem(KEY, kind);
  } catch {
    /* ignore */
  }
}

export const SAT_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const SAT_ATTR = "Tiles © Esri — Esri, Maxar, Earthstar Geographics";

export const STREET_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
export const STREET_ATTR = "&copy; OpenStreetMap &copy; CARTO";
