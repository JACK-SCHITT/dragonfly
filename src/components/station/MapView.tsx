import { useEffect, useRef } from "react";
import { useStation } from "@/gcs/store";
import { offset } from "@/gcs/geo";

type LeafletMap = {
  invalidateSize: () => void;
  panTo: (ll: [number, number], opts?: { animate?: boolean }) => void;
  getCenter: () => { lat: number; lng: number };
  remove: () => void;
};

export function MapView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const followRef = useRef(true);
  const trailPts = useRef<Array<{ lat: number; lng: number }>>([]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;
    let map: LeafletMap | null = null;
    let unsub: (() => void) | undefined;
    let ro: ResizeObserver | undefined;
    let t: number | undefined;
    const onResize = () => map?.invalidateSize();

    void import("leaflet").then((mod) => {
      if (cancelled || !hostRef.current) return;
      const L = mod.default;
      const s0 = useStation.getState();

      const youIcon = L.divIcon({
        className: "",
        html: `<div class="df-marker"><div class="df-you"></div></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const homeIcon = L.divIcon({
        className: "",
        html: `<div class="df-marker"><div class="df-home"></div></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const craftIcon = (heading: number) =>
        L.divIcon({
          className: "",
          html: `<div class="df-craft" style="transform:rotate(${heading}deg)"><svg viewBox="0 0 28 28" fill="none"><path d="M14 3 L17.2 12.5 H24 L18.5 16.2 L20.8 24.5 L14 19.8 L7.2 24.5 L9.5 16.2 L4 12.5 H10.8 Z" fill="#e8eeea"/></svg></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

      map = L.map(el, {
        zoomControl: true,
        attributionControl: true,
        zoomSnap: 0.25,
      }).setView([s0.operator.lat, s0.operator.lng], 18) as unknown as LeafletMap;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map as never);

      const you = L.marker([s0.operator.lat, s0.operator.lng], {
        icon: youIcon,
        zIndexOffset: 600,
      }).addTo(map as never);
      const craft = L.marker([s0.telemetry.lat, s0.telemetry.lng], {
        icon: craftIcon(s0.telemetry.heading),
        zIndexOffset: 700,
      }).addTo(map as never);
      const home = L.marker([s0.operator.lat, s0.operator.lng], {
        icon: homeIcon,
        zIndexOffset: 400,
      }).addTo(map as never);
      const line = L.polyline(
        [
          [s0.operator.lat, s0.operator.lng],
          [s0.telemetry.lat, s0.telemetry.lng],
        ],
        { color: "#c5cdc8", weight: 1, opacity: 0.55, dashArray: "4 6" },
      ).addTo(map as never);
      const orbit = L.circle([s0.operator.lat, s0.operator.lng], {
        radius: s0.follow.orbitRadiusM,
        color: "#8b968f",
        weight: 1,
        opacity: 0.35,
        fillOpacity: 0.04,
        dashArray: "2 8",
      }).addTo(map as never);
      const trail = L.polyline([], { color: "#7d9a84", weight: 2, opacity: 0.45 }).addTo(
        map as never,
      );

      mapRef.current = map;
      const lfMap = map as unknown as {
        on: (ev: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => void;
        getCenter: () => { lat: number; lng: number };
        panTo: (ll: [number, number], opts?: { animate?: boolean }) => void;
      };

      lfMap.on("click", (ev) => {
        const st = useStation.getState();
        if (st.operator.source === "gps") return;
        st.placeOperator(ev.latlng.lat, ev.latlng.lng);
      });
      lfMap.on("dragstart", () => {
        followRef.current = false;
      });

      window.addEventListener("resize", onResize);
      ro = new ResizeObserver(onResize);
      ro.observe(el);

      let lastTrail = 0;
      unsub = useStation.subscribe((st) => {
        const o = st.operator;
        const tel = st.telemetry;
        you.setLatLng([o.lat, o.lng]);
        craft.setLatLng([tel.lat, tel.lng]);
        craft.setIcon(craftIcon(tel.heading));
        if (st.home) {
          home.setLatLng([st.home.lat, st.home.lng]);
          home.setOpacity(1);
        } else {
          home.setOpacity(0);
        }
        line.setLatLngs([
          [o.lat, o.lng],
          [tel.lat, tel.lng],
        ]);
        if (st.flightMode === "orbit") {
          orbit.setLatLng([o.lat, o.lng]);
          orbit.setRadius(st.follow.orbitRadiusM);
          orbit.setStyle({ opacity: 0.45 });
        } else if (st.flightMode === "follow" || st.flightMode === "lead") {
          const behind = offset(
            o,
            st.flightMode === "lead" ? o.heading : o.heading + 180,
            st.follow.distanceM,
          );
          orbit.setLatLng([behind.lat, behind.lng]);
          orbit.setRadius(1.2);
          orbit.setStyle({ opacity: 0.25 });
        } else {
          orbit.setStyle({ opacity: 0 });
        }
        const now = performance.now();
        if (tel.inAir && now - lastTrail > 280) {
          lastTrail = now;
          trailPts.current.push({ lat: tel.lat, lng: tel.lng });
          if (trailPts.current.length > 240) trailPts.current.shift();
          trail.setLatLngs(trailPts.current.map((p) => [p.lat, p.lng] as [number, number]));
        }
        if (followRef.current) {
          const midLat = (o.lat + tel.lat) / 2;
          const midLng = (o.lng + tel.lng) / 2;
          const c = lfMap.getCenter();
          if (Math.abs(c.lat - midLat) + Math.abs(c.lng - midLng) > 0.00004) {
            lfMap.panTo([midLat, midLng], { animate: false });
          }
        }
      });

      t = window.setTimeout(() => map?.invalidateSize(), 80);
    });

    return () => {
      cancelled = true;
      if (t) window.clearTimeout(t);
      unsub?.();
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0 touch-none">
      <div ref={hostRef} className="absolute inset-0" />
      <button
        type="button"
        className="absolute right-3 top-28 z-[500] hidden h-9 rounded-sm bg-surface px-3 text-xs text-muted shadow-[var(--shadow-border)] md:block"
        onClick={() => {
          followRef.current = true;
          const map = mapRef.current;
          const st = useStation.getState();
          if (!map) return;
          map.panTo(
            [
              (st.operator.lat + st.telemetry.lat) / 2,
              (st.operator.lng + st.telemetry.lng) / 2,
            ],
            { animate: true },
          );
        }}
      >
        Recenter
      </button>
    </div>
  );
}
