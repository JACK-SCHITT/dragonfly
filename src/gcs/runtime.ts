import { computeDesired, isLocked } from "./follow";
import { bearingDeg, lerpAngleDeg, moveNorthEast, wrapDeg } from "./geo";
import { currentRadio, sendDesired, vehicleLand, vehicleRtl, vehicleTakeoff } from "./link";
import { useStation } from "./store";
import { emptyTelemetry, type LatLng } from "./types";

const keys = new Set<string>();
let geoWatch: number | null = null;
let orientOn = false;
let lastWrite = 0;
let lastSetpoint = 0;
let lastPreviewHb = 0;

function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  keys.add(e.code);
  if (
    e.code === "ArrowUp" ||
    e.code === "ArrowDown" ||
    e.code === "ArrowLeft" ||
    e.code === "ArrowRight" ||
    e.code === "Space"
  ) {
    e.preventDefault();
  }
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code);
}

function onBlur() {
  keys.clear();
}

function walkFromKeys(): { n: number; e: number } {
  let n = 0;
  let e = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) n += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) n -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) e += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) e -= 1;
  const m = Math.hypot(n, e);
  if (m > 1) {
    n /= m;
    e /= m;
  }
  return { n, e };
}

function startGeo() {
  if (!navigator.geolocation || geoWatch !== null) return;
  geoWatch = navigator.geolocation.watchPosition(
    (pos) => {
      const s = useStation.getState();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let heading = s.operator.heading;
      if (typeof pos.coords.heading === "number" && Number.isFinite(pos.coords.heading)) {
        heading = pos.coords.heading;
      }
      s.setOperator({
        lat,
        lng,
        heading,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed ?? 0,
        source: "gps",
        updatedAt: Date.now(),
      });
      s.setLocation(true, false);
      if (!s.home) s.setHome({ lat, lng });
    },
    () => {
      useStation.getState().setLocation(true, true);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 },
  );
}

function stopGeo() {
  if (geoWatch !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geoWatch);
    geoWatch = null;
  }
}

function onOrient(e: DeviceOrientationEvent) {
  const webkit = e.webkitCompassHeading;
  let heading: number | null = null;
  if (typeof webkit === "number" && Number.isFinite(webkit)) heading = webkit;
  else if (typeof e.alpha === "number" && Number.isFinite(e.alpha)) heading = (360 - e.alpha) % 360;
  if (heading === null) return;
  const s = useStation.getState();
  if (s.operator.source === "gps" || s.operator.source === "none") {
    s.setOperator({ heading });
  }
}

async function startOrient() {
  if (orientOn) return;
  const ctor = window.DeviceOrientationEvent;
  try {
    if (typeof ctor.requestPermission === "function") {
      const perm = await ctor.requestPermission();
      if (perm !== "granted") return;
    }
  } catch {
    return;
  }
  window.addEventListener("deviceorientation", onOrient);
  orientOn = true;
}

function stopOrient() {
  if (!orientOn) return;
  window.removeEventListener("deviceorientation", onOrient);
  orientOn = false;
}

function stepPreview(dt: number, now: number, desired: { lat: number; lng: number; alt: number; yaw: number }, inAir: boolean) {
  const s = useStation.getState();
  const t = s.telemetry;
  if (!inAir) {
    const grounded = {
      ...t,
      altRel: Math.max(0, t.altRel - 1.6 * dt),
      groundSpeed: 0,
      climb: t.altRel > 0.05 ? -1.6 : 0,
      inAir: t.altRel > 0.15,
      armed: t.altRel > 0.15 ? t.armed : false,
      modeText: t.altRel > 0.15 ? "LAND" : "STANDBY",
      batteryPct: Math.min(100, t.batteryPct + dt * 0.4),
    };
    return grounded;
  }

  const maxSpeed = 8;
  const dLatM = (desired.lat - t.lat) * 111_320;
  const dLngM = (desired.lng - t.lng) * 111_320 * Math.cos((t.lat * Math.PI) / 180);
  const horiz = Math.hypot(dLatM, dLngM);
  const speed = Math.min(maxSpeed, Math.max(0.4, horiz * 0.55));
  let n = 0;
  let e = 0;
  if (horiz > 0.25) {
    n = (dLatM / horiz) * speed * dt;
    e = (dLngM / horiz) * speed * dt;
  }
  const next = moveNorthEast({ lat: t.lat, lng: t.lng }, n, e);
  const dAlt = desired.alt - t.altRel;
  const climb = Math.max(-2.4, Math.min(2.4, dAlt * 0.8));
  const altRel = Math.max(0, t.altRel + climb * dt);
  const heading = lerpAngleDeg(t.heading, desired.yaw, 1 - Math.exp(-dt * 3));
  const roll = Math.max(-0.35, Math.min(0.35, e * 0.08));
  const pitch = Math.max(-0.28, Math.min(0.28, -n * 0.06));
  const batteryPct = Math.max(5, t.batteryPct - dt * 0.08);
  return {
    ...t,
    lat: next.lat,
    lng: next.lng,
    altRel,
    heading,
    yaw: (heading * Math.PI) / 180,
    roll,
    pitch,
    groundSpeed: horiz > 0.25 ? speed : 0,
    climb,
    inAir: altRel > 0.2,
    armed: true,
    batteryPct,
    batteryV: 12.6 + (batteryPct / 100) * 4.2,
    sats: 14,
    gpsFix: 3 as const,
    modeText: s.flightMode === "rtl" ? "RTL" : s.flightMode.toUpperCase(),
    autopilot: "Preview",
  };
}

function tick(dt: number, now: number) {
  const s = useStation.getState();
  const walk = walkFromKeys();
  const n = clampStick(walk.n + s.stickN);
  const e = clampStick(walk.e + s.stickE);
  const gpsFresh = s.operator.source === "gps" && now - s.operator.updatedAt < 4000;

  if (Math.abs(n) > 0.05 || Math.abs(e) > 0.05) {
    if (!gpsFresh) {
      const speed = 2.4;
      const next = moveNorthEast(s.operator, n * speed * dt, e * speed * dt);
      s.setOperator({
        lat: next.lat,
        lng: next.lng,
        heading: wrapDeg((Math.atan2(e, n) * 180) / Math.PI),
        source: "manual",
        speed,
        updatedAt: Date.now(),
      });
    }
  }

  if (s.flightMode === "orbit" && s.telemetry.inAir) {
    s.setOrbitAngle(wrapDeg(s.orbitAngleDeg + s.follow.orbitRateDeg * dt));
  }

  const desired = computeDesired({
    mode: s.flightMode,
    operator: s.operator,
    craft: s.telemetry,
    params: s.follow,
    home: s.home,
    hoverHold: s.hoverHold,
    orbitAngleDeg: s.orbitAngleDeg,
  });

  const radio = currentRadio();
  if (radio) {
    if (s.telemetry.armed && s.telemetry.inAir && now - lastSetpoint > 200) {
      lastSetpoint = now;
      void sendDesired(desired);
    }
    if (s.lastHeartbeatMs && now - s.lastHeartbeatMs > 3500 && s.linkStatus === "live") {
      s.setLinkStatus("lost");
      s.pushLog("Heartbeat timeout");
    }
  } else {
    let inAir = s.telemetry.inAir;
    if (s.takingOff && !inAir) {
      s.setTelemetry({ armed: true, inAir: true, modeText: "TAKEOFF", altRel: Math.max(s.telemetry.altRel, 0.3) });
      inAir = true;
    }
    if (s.flightMode === "rtl" && s.home) {
      const distHome = Math.hypot(
        (s.telemetry.lat - s.home.lat) * 111320,
        (s.telemetry.lng - s.home.lng) * 111320,
      );
      if (distHome < 1.5 && s.telemetry.altRel < 1.2) {
        inAir = false;
        s.setTakingOff(false);
      }
    }
    let pose = desired;
    if (s.telemetry.modeText === "LAND") {
      pose = { lat: s.telemetry.lat, lng: s.telemetry.lng, alt: 0, yaw: s.telemetry.heading };
    }
    const nextTel = stepPreview(
      dt,
      now,
      pose,
      s.telemetry.modeText === "LAND" ? s.telemetry.altRel > 0.25 : inAir && s.flightMode !== "rtl" ? true : inAir,
    );
    if (s.flightMode === "rtl") {
      const landed = stepPreview(dt, now, { ...desired, alt: 0 }, nextTel.altRel > 0.4);
      s.setTelemetry(landed);
    } else if (s.telemetry.modeText === "LAND" && nextTel.altRel <= 0.25) {
      s.setTelemetry({
        ...nextTel,
        armed: false,
        inAir: false,
        modeText: "STANDBY",
        climb: 0,
      });
      s.setTakingOff(false);
    } else {
      s.setTelemetry(nextTel);
    }
    if (now - lastPreviewHb > 1000) {
      lastPreviewHb = now;
      s.setLastHeartbeat(now);
    }
  }

  const craft: LatLng = { lat: useStation.getState().telemetry.lat, lng: useStation.getState().telemetry.lng };
  const tel = useStation.getState().telemetry;
  const locked = isLocked(craft, desired, tel.altRel, tel.inAir);
  if (now - lastWrite > 80) {
    lastWrite = now;
    s.setDesired(desired);
    s.setLocked(locked);
  }
}

function clampStick(v: number) {
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

export async function requestLocation() {
  startGeo();
  void startOrient();
  if (!navigator.geolocation) {
    useStation.getState().setLocation(true, true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const s = useStation.getState();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      s.setOperator({
        lat,
        lng,
        accuracy: pos.coords.accuracy,
        source: "gps",
        updatedAt: Date.now(),
      });
      s.setTelemetry({ ...emptyTelemetry({ lat, lng }), sats: 0 });
      s.setHome({ lat, lng });
      s.setLocation(true, false);
      s.pushLog("Phone location locked");
    },
    () => {
      useStation.getState().setLocation(true, true);
      useStation.getState().pushLog("Location denied — tap the map to set the beacon");
    },
    { enableHighAccuracy: true, timeout: 8000 },
  );
}

export async function commandTakeoff() {
  const s = useStation.getState();
  if (!s.home) s.setHome({ lat: s.operator.lat, lng: s.operator.lng });
  s.setFlightStartedAt(Date.now());
  s.setTakingOff(true);
  s.pushLog(`Takeoff to ${s.follow.heightM.toFixed(0)} m`);
  if (currentRadio()) {
    await vehicleTakeoff(s.follow.heightM);
  } else {
    s.setTelemetry({ armed: true, inAir: true, modeText: "TAKEOFF" });
  }
}

export async function commandLand() {
  const s = useStation.getState();
  s.setTakingOff(false);
  s.pushLog("Land");
  if (currentRadio()) {
    await vehicleLand();
    return;
  }
  s.setHoverHold({ lat: s.telemetry.lat, lng: s.telemetry.lng });
  s.setFlightMode("hover");
  s.setTelemetry({ modeText: "LAND" });
}

export async function commandRtl() {
  const s = useStation.getState();
  s.setTakingOff(false);
  s.setFlightMode("rtl");
  if (currentRadio()) await vehicleRtl();
}

export function startRuntime() {
  useStation.getState().setCapabilities("serial" in navigator, "bluetooth" in navigator);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onBlur);
  startGeo();
  void startOrient();

  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    tick(dt, now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onBlur);
    stopGeo();
    stopOrient();
    keys.clear();
  };
}

void bearingDeg;
