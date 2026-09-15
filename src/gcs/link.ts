import {
  MavParser,
  MSG,
  autopilotName,
  copterModeName,
  packArm,
  packHeartbeat,
  packLand,
  packPositionTargetGlobal,
  packRtl,
  packSetMessageInterval,
  packSetModeGuided,
  packTakeoff,
  type MavMessage,
  MAV_AUTOPILOT_ARDUPILOTMEGA,
  MAV_MODE_FLAG_SAFETY_ARMED,
} from "./mavlink";
import { toRad } from "./geo";
import { useStation } from "./store";
import type { DesiredPose, GpsFix, LinkKind } from "./types";

const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

export interface RadioLink {
  kind: Exclude<LinkKind, "preview">;
  send(bytes: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

let radio: RadioLink | null = null;
let heartbeatTimer: number | null = null;
const parser = new MavParser();
let ardupilot = true;
let targetSys = 1;
let ratesRequested = false;

function applyMessage(msg: MavMessage) {
  const s = useStation.getState();
  s.setLastHeartbeat(performance.now());
  if (s.linkStatus !== "live") {
    s.setLinkStatus("live");
    s.pushLog(`Link live · sys ${msg.sysid}`);
  }

  switch (msg.id) {
    case MSG.HEARTBEAT: {
      if (msg.type === 6) return;
      targetSys = msg.sysid || 1;
      ardupilot = msg.autopilot === MAV_AUTOPILOT_ARDUPILOTMEGA;
      const armed = (msg.baseMode & MAV_MODE_FLAG_SAFETY_ARMED) !== 0;
      s.setTelemetry({
        sysid: targetSys,
        autopilot: autopilotName(msg.autopilot),
        armed,
        modeText: copterModeName(msg.autopilot, msg.customMode),
      });
      if (!ratesRequested) {
        ratesRequested = true;
        void requestRates();
      }
      break;
    }
    case MSG.SYS_STATUS:
      s.setTelemetry({
        voltageMv: msg.voltageMv,
        batteryV: msg.voltageMv / 1000,
        batteryPct:
          msg.batteryRemaining >= 0 ? msg.batteryRemaining : s.telemetry.batteryPct,
      });
      break;
    case MSG.GPS_RAW_INT:
      s.setTelemetry({
        gpsFix: Math.min(6, msg.fixType) as GpsFix,
        sats: msg.sats,
      });
      break;
    case MSG.ATTITUDE:
      s.setTelemetry({
        roll: msg.roll,
        pitch: msg.pitch,
        yaw: msg.yaw,
        heading: ((msg.yaw * 180) / Math.PI + 360) % 360,
      });
      break;
    case MSG.GLOBAL_POSITION_INT: {
      const heading = msg.hdgCdeg === 65535 ? s.telemetry.heading : msg.hdgCdeg / 100;
      const vx = msg.vx / 100;
      const vy = msg.vy / 100;
      s.setTelemetry({
        lat: msg.lat,
        lng: msg.lng,
        altRel: msg.relativeAltMs / 1000,
        heading,
        groundSpeed: Math.hypot(vx, vy),
        climb: -msg.vz / 100,
        inAir: msg.relativeAltMs > 800 || s.telemetry.armed,
      });
      break;
    }
    case MSG.VFR_HUD:
      s.setTelemetry({
        groundSpeed: msg.groundspeed,
        heading: msg.heading < 0 ? s.telemetry.heading : msg.heading,
        climb: msg.climb,
        altRel: msg.alt,
      });
      break;
    case MSG.BATTERY_STATUS:
      if (msg.remaining >= 0) s.setTelemetry({ batteryPct: msg.remaining });
      break;
    case MSG.STATUSTEXT:
      if (msg.text) s.pushLog(msg.text);
      break;
    case MSG.COMMAND_ACK:
      if (msg.result !== 0 && msg.result !== 5) {
        s.pushLog(`Command ${msg.command} result ${msg.result}`);
      }
      break;
    case MSG.HOME_POSITION:
      s.setHome({ lat: msg.lat, lng: msg.lng });
      break;
    default:
      break;
  }
}

function ingest(bytes: Uint8Array) {
  for (const msg of parser.push(bytes)) applyMessage(msg);
}

async function requestRates() {
  if (!radio) return;
  const specs: Array<[number, number]> = [
    [MSG.ATTITUDE, 10],
    [MSG.GLOBAL_POSITION_INT, 5],
    [MSG.SYS_STATUS, 1],
    [MSG.GPS_RAW_INT, 2],
    [MSG.VFR_HUD, 4],
    [MSG.BATTERY_STATUS, 1],
  ];
  for (const [id, hz] of specs) {
    await radio.send(packSetMessageInterval(targetSys, id, hz));
  }
}

function startHeartbeat() {
  stopHeartbeat();
  const tick = () => {
    void radio?.send(packHeartbeat());
  };
  tick();
  heartbeatTimer = window.setInterval(tick, 1000);
}

function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function currentRadio() {
  return radio;
}

export function isRadioLive() {
  return radio !== null && useStation.getState().linkStatus === "live";
}

export async function sendDesired(desired: DesiredPose) {
  if (!radio) return;
  await radio.send(
    packPositionTargetGlobal(targetSys, desired.lat, desired.lng, desired.alt, toRad(desired.yaw)),
  );
}

export async function vehicleTakeoff(altM: number) {
  if (!radio) return;
  await radio.send(packSetModeGuided(targetSys, ardupilot));
  await radio.send(packArm(targetSys, true));
  await radio.send(packTakeoff(targetSys, altM));
}

export async function vehicleLand() {
  if (!radio) return;
  await radio.send(packLand(targetSys));
}

export async function vehicleRtl() {
  if (!radio) return;
  await radio.send(packRtl(targetSys));
}

export async function disconnectRadio() {
  stopHeartbeat();
  ratesRequested = false;
  const current = radio;
  radio = null;
  useStation.getState().setLinkKind("preview");
  useStation.getState().setLinkStatus("live");
  useStation.getState().setTelemetry({ autopilot: "Preview", modeText: "STANDBY" });
  if (current) await current.close();
}

async function attachRadio(next: RadioLink, label: string) {
  await disconnectRadio();
  radio = next;
  const s = useStation.getState();
  s.setLinkKind(next.kind);
  s.setLinkStatus("connecting");
  s.pushLog(`Opening ${label}`);
  startHeartbeat();
}

export async function connectSerial(baud: number) {
  const serial = navigator.serial;
  if (!serial) throw new Error("Web Serial is not available in this browser.");
  const port = await serial.requestPort();
  await port.open({ baudRate: baud });
  const reader = port.readable?.getReader();
  const writer = port.writable?.getWriter();
  if (!reader || !writer) throw new Error("Serial port has no streams.");
  let closed = false;
  const link: RadioLink = {
    kind: "serial",
    async send(bytes) {
      if (closed) return;
      await writer.write(bytes);
    },
    async close() {
      closed = true;
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
      try {
        writer.releaseLock();
      } catch {
        /* ignore */
      }
      try {
        await port.close();
      } catch {
        /* ignore */
      }
    },
  };
  await attachRadio(link, `USB serial · ${baud}`);
  void (async () => {
    try {
      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) ingest(value);
      }
    } catch {
      useStation.getState().setLinkStatus("lost");
      useStation.getState().pushLog("Serial link lost");
    }
  })();
}

export async function connectBluetooth() {
  const bluetooth = navigator.bluetooth;
  if (!bluetooth) throw new Error("Web Bluetooth is not available in this browser.");
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [NUS_SERVICE],
  });
  const gatt = device.gatt;
  if (!gatt) throw new Error("Device has no GATT server.");
  const server = await gatt.connect();
  const service = await server.getPrimaryService(NUS_SERVICE);
  const tx = await service.getCharacteristic(NUS_TX);
  const rx = await service.getCharacteristic(NUS_RX);
  await tx.startNotifications();
  const onValue = () => {
    const v = tx.value;
    if (v) ingest(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  };
  tx.addEventListener("characteristicvaluechanged", onValue);
  const onDisc = () => {
    useStation.getState().setLinkStatus("lost");
    useStation.getState().pushLog("Bluetooth link lost");
  };
  device.addEventListener("gattserverdisconnected", onDisc);
  let closed = false;
  const link: RadioLink = {
    kind: "bluetooth",
    async send(bytes) {
      if (closed) return;
      const chunk = 20;
      for (let i = 0; i < bytes.length; i += chunk) {
        const slice = bytes.subarray(i, i + chunk);
        const buf = new Uint8Array(slice.length);
        buf.set(slice);
        await rx.writeValueWithoutResponse(buf);
      }
    },
    async close() {
      closed = true;
      tx.removeEventListener("characteristicvaluechanged", onValue);
      device.removeEventListener("gattserverdisconnected", onDisc);
      try {
        await tx.stopNotifications();
      } catch {
        /* ignore */
      }
      try {
        server.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
  await attachRadio(link, device.name ?? "Bluetooth radio");
}
