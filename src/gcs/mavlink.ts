/**
 * MAVLink v2 codec for the messages Dragonfly actually sends and reads.
 * Wire format matches common.xml (ArduPilot / PX4).
 */

const STX = 0xfd;
const GCS_SYSID = 255;
const GCS_COMPID = 190;

export const CRC_EXTRA: Record<number, number> = {
  0: 50, // HEARTBEAT
  1: 124, // SYS_STATUS
  11: 89, // SET_MODE
  24: 24, // GPS_RAW_INT
  30: 39, // ATTITUDE
  33: 104, // GLOBAL_POSITION_INT
  66: 148, // REQUEST_DATA_STREAM
  74: 20, // VFR_HUD
  76: 152, // COMMAND_LONG
  77: 143, // COMMAND_ACK
  86: 5, // SET_POSITION_TARGET_GLOBAL_INT
  147: 154, // BATTERY_STATUS
  242: 104, // HOME_POSITION
  253: 83, // STATUSTEXT
};

export const MSG = {
  HEARTBEAT: 0,
  SYS_STATUS: 1,
  SET_MODE: 11,
  GPS_RAW_INT: 24,
  ATTITUDE: 30,
  GLOBAL_POSITION_INT: 33,
  REQUEST_DATA_STREAM: 66,
  VFR_HUD: 74,
  COMMAND_LONG: 76,
  COMMAND_ACK: 77,
  SET_POSITION_TARGET_GLOBAL_INT: 86,
  BATTERY_STATUS: 147,
  HOME_POSITION: 242,
  STATUSTEXT: 253,
} as const;

export const MAV_CMD = {
  NAV_TAKEOFF: 22,
  NAV_LAND: 21,
  NAV_RETURN_TO_LAUNCH: 20,
  DO_SET_MODE: 176,
  COMPONENT_ARM_DISARM: 400,
  SET_MESSAGE_INTERVAL: 511,
} as const;

export const MAV_TYPE_GCS = 6;
export const MAV_AUTOPILOT_INVALID = 8;
export const MAV_STATE_ACTIVE = 4;
export const MAV_MODE_FLAG_SAFETY_ARMED = 128;
export const MAV_MODE_FLAG_CUSTOM_MODE_ENABLED = 1;
export const MAV_FRAME_GLOBAL_RELATIVE_ALT_INT = 6;
export const MAV_AUTOPILOT_ARDUPILOTMEGA = 3;
export const MAV_AUTOPILOT_PX4 = 12;

export const COPTER_MODE: Record<number, string> = {
  0: "STABILIZE",
  1: "ACRO",
  2: "ALT_HOLD",
  3: "AUTO",
  4: "GUIDED",
  5: "LOITER",
  6: "RTL",
  7: "CIRCLE",
  9: "LAND",
  11: "DRIFT",
  13: "SPORT",
  16: "POSHOLD",
  17: "BRAKE",
  20: "GUIDED_NOGPS",
  21: "SMART_RTL",
};

export type MavMessage =
  | { id: typeof MSG.HEARTBEAT; sysid: number; type: number; autopilot: number; baseMode: number; customMode: number; systemStatus: number }
  | { id: typeof MSG.SYS_STATUS; sysid: number; voltageMv: number; batteryRemaining: number }
  | { id: typeof MSG.GPS_RAW_INT; sysid: number; fixType: number; sats: number; lat: number; lng: number }
  | { id: typeof MSG.ATTITUDE; sysid: number; roll: number; pitch: number; yaw: number }
  | { id: typeof MSG.GLOBAL_POSITION_INT; sysid: number; lat: number; lng: number; altMs: number; relativeAltMs: number; vx: number; vy: number; vz: number; hdgCdeg: number }
  | { id: typeof MSG.VFR_HUD; sysid: number; airspeed: number; groundspeed: number; heading: number; throttle: number; alt: number; climb: number }
  | { id: typeof MSG.COMMAND_ACK; sysid: number; command: number; result: number }
  | { id: typeof MSG.BATTERY_STATUS; sysid: number; remaining: number }
  | { id: typeof MSG.STATUSTEXT; sysid: number; severity: number; text: string }
  | { id: typeof MSG.HOME_POSITION; sysid: number; lat: number; lng: number; altMs: number };

function crcAccumulate(data: number, crc: number) {
  let tmp = (data ^ (crc & 0xff)) & 0xff;
  tmp = (tmp ^ ((tmp << 4) & 0xff)) & 0xff;
  return ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
}

function crcBlock(bytes: Uint8Array, extra: number) {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) crc = crcAccumulate(bytes[i]!, crc);
  crc = crcAccumulate(extra, crc);
  return crc;
}

let seq = 0;

export function pack(msgid: number, payload: Uint8Array, sysid = GCS_SYSID, compid = GCS_COMPID) {
  const extra = CRC_EXTRA[msgid];
  if (extra === undefined) throw new Error(`no crc extra for msgid ${msgid}`);
  const len = payload.length;
  const header = new Uint8Array(10 + len);
  header[0] = STX;
  header[1] = len;
  header[2] = 0;
  header[3] = 0;
  header[4] = seq++ & 0xff;
  header[5] = sysid;
  header[6] = compid;
  header[7] = msgid & 0xff;
  header[8] = (msgid >> 8) & 0xff;
  header[9] = (msgid >> 16) & 0xff;
  header.set(payload, 10);
  const crc = crcBlock(header.subarray(1, 10 + len), extra);
  const out = new Uint8Array(12 + len);
  out.set(header, 0);
  out[10 + len] = crc & 0xff;
  out[11 + len] = (crc >> 8) & 0xff;
  return out;
}

export function packHeartbeat() {
  const p = new Uint8Array(9);
  p[0] = MAV_TYPE_GCS;
  p[1] = MAV_AUTOPILOT_INVALID;
  p[2] = 0;
  p[7] = MAV_STATE_ACTIVE;
  p[8] = 3;
  return pack(MSG.HEARTBEAT, p);
}

export function packCommandLong(
  targetSys: number,
  command: number,
  params: number[] = [],
  confirmation = 0,
) {
  const buf = new ArrayBuffer(33);
  const dv = new DataView(buf);
  dv.setUint8(0, targetSys);
  dv.setUint8(1, 1);
  dv.setUint16(2, command, true);
  dv.setUint8(4, confirmation);
  for (let i = 0; i < 7; i++) dv.setFloat32(5 + i * 4, params[i] ?? 0, true);
  return pack(MSG.COMMAND_LONG, new Uint8Array(buf));
}

export function packArm(targetSys: number, arm: boolean, force = false) {
  return packCommandLong(targetSys, MAV_CMD.COMPONENT_ARM_DISARM, [
    arm ? 1 : 0,
    force ? 21196 : 0,
  ]);
}

export function packTakeoff(targetSys: number, altM: number) {
  return packCommandLong(targetSys, MAV_CMD.NAV_TAKEOFF, [0, 0, 0, 0, 0, 0, altM]);
}

export function packLand(targetSys: number) {
  return packCommandLong(targetSys, MAV_CMD.NAV_LAND, []);
}

export function packRtl(targetSys: number) {
  return packCommandLong(targetSys, MAV_CMD.NAV_RETURN_TO_LAUNCH, []);
}

export function packSetModeGuided(targetSys: number, ardupilot: boolean) {
  if (ardupilot) {
    return packCommandLong(targetSys, MAV_CMD.DO_SET_MODE, [
      MAV_MODE_FLAG_CUSTOM_MODE_ENABLED | MAV_MODE_FLAG_SAFETY_ARMED,
      4,
    ]);
  }
  // PX4 custom_mode: main = 4 (AUTO), sub = 3 (AUTO.MISSION) is wrong for follow.
  // PX4 offboard is main=6; GUIDED-like is AUTO.LOITER main=4 sub=3... use AUTO.TAKEOFF then setpoints.
  // custom_mode packing: (main << 16) | (sub << 24) | (reserved)
  // AUTO.FOLLOW_TARGET isn't universal. AUTO.LOITER = custom 0x03040000-ish.
  // Send DO_SET_MODE with custom 4 for AP; for PX4 send 0x06000000 (OFFBOARD).
  const custom = 6; // PX4 OFFBOARD main mode
  return packCommandLong(targetSys, MAV_CMD.DO_SET_MODE, [1, custom]);
}

export function packSetMessageInterval(targetSys: number, msgid: number, hz: number) {
  const interval = hz <= 0 ? -1 : Math.round(1_000_000 / hz);
  return packCommandLong(targetSys, MAV_CMD.SET_MESSAGE_INTERVAL, [msgid, interval]);
}

export function packPositionTargetGlobal(
  targetSys: number,
  lat: number,
  lng: number,
  altRel: number,
  yawRad: number,
) {
  const buf = new ArrayBuffer(51);
  const dv = new DataView(buf);
  dv.setUint32(0, 0, true);
  dv.setUint8(4, targetSys);
  dv.setUint8(5, 1);
  dv.setUint8(6, MAV_FRAME_GLOBAL_RELATIVE_ALT_INT);
  // ignore vx,vy,vz,ax,ay,az,force,yaw_rate — use lat/lon/alt + yaw
  dv.setUint16(7, 0x0bf8, true);
  dv.setInt32(9, Math.round(lat * 1e7), true);
  dv.setInt32(13, Math.round(lng * 1e7), true);
  dv.setFloat32(17, altRel, true);
  dv.setFloat32(45, yawRad, true);
  return pack(MSG.SET_POSITION_TARGET_GLOBAL_INT, new Uint8Array(buf));
}

function readCString(bytes: Uint8Array) {
  let end = bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      end = i;
      break;
    }
  }
  return new TextDecoder().decode(bytes.subarray(0, end)).trim();
}

function parsePayload(msgid: number, sysid: number, p: Uint8Array): MavMessage | null {
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  switch (msgid) {
    case MSG.HEARTBEAT:
      if (p.length < 9) return null;
      return {
        id: MSG.HEARTBEAT,
        sysid,
        type: p[0]!,
        autopilot: p[1]!,
        baseMode: p[2]!,
        customMode: dv.getUint32(3, true),
        systemStatus: p[7]!,
      };
    case MSG.SYS_STATUS:
      if (p.length < 31) return null;
      return {
        id: MSG.SYS_STATUS,
        sysid,
        voltageMv: dv.getUint16(14, true),
        batteryRemaining: dv.getInt8(30),
      };
    case MSG.GPS_RAW_INT:
      if (p.length < 30) return null;
      return {
        id: MSG.GPS_RAW_INT,
        sysid,
        fixType: p[28]!,
        sats: p[29]!,
        lat: dv.getInt32(8, true) / 1e7,
        lng: dv.getInt32(12, true) / 1e7,
      };
    case MSG.ATTITUDE:
      if (p.length < 28) return null;
      return {
        id: MSG.ATTITUDE,
        sysid,
        roll: dv.getFloat32(4, true),
        pitch: dv.getFloat32(8, true),
        yaw: dv.getFloat32(12, true),
      };
    case MSG.GLOBAL_POSITION_INT:
      if (p.length < 28) return null;
      return {
        id: MSG.GLOBAL_POSITION_INT,
        sysid,
        lat: dv.getInt32(4, true) / 1e7,
        lng: dv.getInt32(8, true) / 1e7,
        altMs: dv.getInt32(12, true),
        relativeAltMs: dv.getInt32(16, true),
        vx: dv.getInt16(20, true),
        vy: dv.getInt16(22, true),
        vz: dv.getInt16(24, true),
        hdgCdeg: dv.getUint16(26, true),
      };
    case MSG.VFR_HUD:
      if (p.length < 20) return null;
      return {
        id: MSG.VFR_HUD,
        sysid,
        airspeed: dv.getFloat32(0, true),
        groundspeed: dv.getFloat32(4, true),
        heading: dv.getInt16(8, true),
        throttle: dv.getUint16(10, true),
        alt: dv.getFloat32(12, true),
        climb: dv.getFloat32(16, true),
      };
    case MSG.COMMAND_ACK:
      if (p.length < 3) return null;
      return { id: MSG.COMMAND_ACK, sysid, command: dv.getUint16(0, true), result: p[2]! };
    case MSG.BATTERY_STATUS:
      if (p.length < 36) return null;
      return { id: MSG.BATTERY_STATUS, sysid, remaining: dv.getInt8(35) };
    case MSG.STATUSTEXT:
      if (p.length < 51) return null;
      return {
        id: MSG.STATUSTEXT,
        sysid,
        severity: p[0]!,
        text: readCString(p.subarray(1, 51)),
      };
    case MSG.HOME_POSITION:
      if (p.length < 12) return null;
      return {
        id: MSG.HOME_POSITION,
        sysid,
        lat: dv.getInt32(0, true) / 1e7,
        lng: dv.getInt32(4, true) / 1e7,
        altMs: dv.getInt32(8, true),
      };
    default:
      return null;
  }
}

export class MavParser {
  private buf = new Uint8Array(0);

  push(chunk: Uint8Array): MavMessage[] {
    const next = new Uint8Array(this.buf.length + chunk.length);
    next.set(this.buf, 0);
    next.set(chunk, this.buf.length);
    this.buf = next;
    const out: MavMessage[] = [];
    let i = 0;
    while (i < this.buf.length) {
      if (this.buf[i] !== STX) {
        i += 1;
        continue;
      }
      if (i + 10 > this.buf.length) break;
      const len = this.buf[i + 1]!;
      const incompat = this.buf[i + 2]!;
      const sig = incompat & 0x01 ? 13 : 0;
      const frame = 12 + len + sig;
      if (i + frame > this.buf.length) break;
      const msgid =
        this.buf[i + 7]! | (this.buf[i + 8]! << 8) | (this.buf[i + 9]! << 16);
      const extra = CRC_EXTRA[msgid];
      if (extra !== undefined) {
        const crcExpect = this.buf[i + 10 + len]! | (this.buf[i + 11 + len]! << 8);
        const crc = crcBlock(this.buf.subarray(i + 1, i + 10 + len), extra);
        if (crc === crcExpect) {
          const payload = this.buf.subarray(i + 10, i + 10 + len);
          const msg = parsePayload(msgid, this.buf[i + 5]!, payload);
          if (msg) out.push(msg);
        }
      }
      i += frame;
    }
    this.buf = this.buf.subarray(i);
    if (this.buf.length > 8192) this.buf = new Uint8Array(0);
    return out;
  }
}

export function autopilotName(id: number) {
  if (id === MAV_AUTOPILOT_ARDUPILOTMEGA) return "ArduPilot";
  if (id === MAV_AUTOPILOT_PX4) return "PX4";
  if (id === 0) return "Generic";
  return `AP ${id}`;
}

export function copterModeName(autopilot: number, customMode: number) {
  if (autopilot === MAV_AUTOPILOT_ARDUPILOTMEGA) {
    return COPTER_MODE[customMode] ?? `MODE ${customMode}`;
  }
  if (autopilot === MAV_AUTOPILOT_PX4) {
    const main = (customMode >> 16) & 0xff;
    const names: Record<number, string> = {
      1: "MANUAL",
      2: "ALTITUDE",
      3: "POSITION",
      4: "AUTO",
      5: "ACRO",
      6: "OFFBOARD",
      7: "STABILIZED",
    };
    return names[main] ?? `PX4 ${main}`;
  }
  return "VEHICLE";
}
