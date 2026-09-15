import { distanceM } from "./geo";
import type { FlightMode, Operator, Telemetry } from "./types";

export type ChannelId =
  | "system"
  | "x"
  | "threads"
  | "whatsapp"
  | "telegram"
  | "copy"
  | "card";

export interface Channel {
  id: ChannelId;
  name: string;
  hint: string;
}

export const CHANNELS: Channel[] = [
  { id: "system", name: "Phone share", hint: "Instagram, TikTok, Facebook — attaches the tape when you have one" },
  { id: "x", name: "X", hint: "Opens a compose window with the caption" },
  { id: "threads", name: "Threads", hint: "Opens Threads compose" },
  { id: "whatsapp", name: "WhatsApp", hint: "Send the recap as a message" },
  { id: "telegram", name: "Telegram", hint: "Share to a chat or channel" },
  { id: "copy", name: "Copy caption", hint: "Paste into any app" },
  { id: "card", name: "Save still", hint: "PNG card for Instagram, TikTok, Reels" },
];

export type CaptionKind = "lock" | "airborne" | "orbit" | "recap";

export interface FlightSnapshot {
  mode: FlightMode;
  locked: boolean;
  inAir: boolean;
  altRel: number;
  distM: number;
  heading: number;
  speed: number;
  sats: number;
  link: string;
  autopilot: string;
  lat: number;
  lng: number;
  durationS: number;
}

export interface SharePost {
  id: string;
  t: number;
  channel: ChannelId;
  caption: string;
}

const POSTS_KEY = "dragonfly.posts.v1";

export function snapshotFlight(
  tel: Telemetry,
  operator: Operator,
  mode: FlightMode,
  locked: boolean,
  linkKind: string,
  startedAt: number | null,
): FlightSnapshot {
  return {
    mode,
    locked,
    inAir: tel.inAir,
    altRel: tel.altRel,
    distM: distanceM(operator, tel),
    heading: tel.heading,
    speed: tel.groundSpeed,
    sats: tel.sats,
    link: linkKind,
    autopilot: tel.autopilot || "preview",
    lat: tel.lat,
    lng: tel.lng,
    durationS: startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0,
  };
}

export function composeCaption(kind: CaptionKind, s: FlightSnapshot) {
  const alt = s.altRel.toFixed(0);
  const dst = s.distM.toFixed(0);
  const mode = s.mode.toUpperCase();
  const lock = s.locked ? "Locked on the phone." : s.inAir ? "Acquiring lock." : "On deck.";
  const air = s.autopilot && s.autopilot !== "preview" ? s.autopilot : "Preview aircraft";
  const dur =
    s.durationS >= 60
      ? `${Math.floor(s.durationS / 60)}m ${Math.round(s.durationS % 60)}s`
      : `${Math.round(s.durationS)}s`;

  if (kind === "airborne") {
    return `${air} is up.\nFollow-me · ${alt} m AGL · ${dst} m off the beacon.\n${lock}\n\n#DRAGONFLY`;
  }
  if (kind === "orbit") {
    return `Orbit around the beacon.\n${alt} m AGL · ${dst} m radius.\n${lock}\n\n#DRAGONFLY`;
  }
  if (kind === "recap") {
    return `Flight recap · ${dur}\nMode ${mode} · ${alt} m · ${dst} m from the phone.\n${air}.\n\nConcept: Johnnie Alderman · KRACKERJACK support\n#DRAGONFLY`;
  }
  return `${lock}\n${mode} · ${alt} m AGL · ${dst} m back.\nPhone GPS is the beacon.\n\n#DRAGONFLY`;
}

export function loadPosts(): SharePost[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SharePost[];
    return Array.isArray(parsed) ? parsed.slice(-24) : [];
  } catch {
    return [];
  }
}

export function savePosts(posts: SharePost[]) {
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts.slice(-24)));
  } catch {
    /* ignore */
  }
}

function encode(text: string) {
  return encodeURIComponent(text);
}

export function channelHref(id: ChannelId, caption: string): string | null {
  if (id === "x") return `https://twitter.com/intent/tweet?text=${encode(caption)}`;
  if (id === "threads") return `https://www.threads.net/intent/post?text=${encode(caption)}`;
  if (id === "whatsapp") return `https://wa.me/?text=${encode(caption)}`;
  if (id === "telegram") return `https://t.me/share/url?text=${encode(caption)}`;
  return null;
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export async function shareSystem(caption: string, file?: File) {
  const payload: ShareData = { text: caption, title: "DRAGONFLY" };
  if (file && navigator.canShare?.({ files: [file] })) {
    payload.files = [file];
  }
  if (navigator.share) {
    await navigator.share(payload);
    return true;
  }
  await copyText(caption);
  return false;
}

export async function renderShareCard(s: FlightSnapshot): Promise<Blob> {
  const w = 1080;
  const h = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");

  try {
    await document.fonts.ready;
  } catch {
    /* continue */
  }

  ctx.fillStyle = "#090c0b";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#1a221e";
  ctx.fillRect(72, 980, w - 144, 2);

  ctx.fillStyle = "#6a736e";
  ctx.font = "500 22px 'IBM Plex Mono', monospace";
  ctx.letterSpacing = "0.28em";
  ctx.fillText("GROUND STATION", 80, 120);

  ctx.fillStyle = "#e8eeea";
  ctx.letterSpacing = "-0.03em";
  ctx.font = "500 92px Newsreader, Georgia, serif";
  ctx.fillText("DRAGONFLY", 72, 230);

  ctx.fillStyle = s.locked ? "#7d9a84" : "#8b968f";
  ctx.letterSpacing = "0.18em";
  ctx.font = "500 28px 'IBM Plex Mono', monospace";
  ctx.fillText(s.locked ? "LOCKED ON YOU" : s.inAir ? "ACQUIRING" : "ON DECK", 80, 310);

  const rows = [
    ["MODE", s.mode.toUpperCase()],
    ["ALT", `${s.altRel.toFixed(1)} m`],
    ["DST", `${s.distM.toFixed(1)} m`],
    ["SPD", `${s.speed.toFixed(1)} m/s`],
    ["HDG", `${Math.round(s.heading).toString().padStart(3, "0")}°`],
    ["LINK", s.link.toUpperCase()],
  ];
  rows.forEach((row, i) => {
    const y = 430 + i * 72;
    ctx.fillStyle = "#6a736e";
    ctx.letterSpacing = "0.16em";
    ctx.font = "400 24px 'IBM Plex Mono', monospace";
    ctx.fillText(row[0], 80, y);
    ctx.fillStyle = "#e8eeea";
    ctx.letterSpacing = "0";
    ctx.font = "500 32px Outfit, sans-serif";
    ctx.fillText(row[1], 280, y);
  });

  ctx.fillStyle = "#8b968f";
  ctx.font = "400 24px Outfit, sans-serif";
  ctx.letterSpacing = "0";
  ctx.fillText("Concept  Johnnie Alderman", 80, 1120);
  ctx.fillText("Support  KRACKERJACK", 80, 1164);
  ctx.fillStyle = "#6a736e";
  ctx.font = "400 20px 'IBM Plex Mono', monospace";
  ctx.fillText(`${s.lat.toFixed(5)}  ${s.lng.toFixed(5)}`, 80, 1240);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png");
  });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
