import { useStation } from "./store";

const W = 1080;
const H = 1920;

type Clip = { blob: Blob; url: string; name: string; hasCam: boolean; hasMic: boolean };

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let mix: MediaStream | null = null;
let cam: MediaStream | null = null;
let canvas: HTMLCanvasElement | null = null;
let videoEl: HTMLVideoElement | null = null;
let raf = 0;
let startedAt = 0;
let lastClock = 0;
let clip: Clip | null = null;
let trail: Array<{ x: number; y: number }> = [];

export function lastTape() {
  return clip;
}

export function cameraStream() {
  return cam;
}

function pickMime() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm",
    "video/mp4",
  ];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

async function acquire(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: true,
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        return new MediaStream();
      }
    }
  }
}

function cover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement) {
  if (!video.videoWidth) return false;
  const vr = video.videoWidth / video.videoHeight;
  const cr = W / H;
  let dw: number;
  let dh: number;
  if (vr > cr) {
    dh = H;
    dw = H * vr;
  } else {
    dw = W;
    dh = W / vr;
  }
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return true;
}

function drawHud(ctx: CanvasRenderingContext2D) {
  const s = useStation.getState();
  const tel = s.telemetry;
  const t = (performance.now() - startedAt) / 1000;
  const mm = Math.floor(t / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(t % 60)
    .toString()
    .padStart(2, "0");

  ctx.fillStyle = "rgba(9,12,11,0.45)";
  ctx.fillRect(0, 0, W, 220);
  ctx.fillRect(0, H - 280, W, 280);

  ctx.fillStyle = "#c47a72";
  ctx.beginPath();
  ctx.arc(88, 88, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8eeea";
  ctx.font = "500 36px 'IBM Plex Mono', monospace";
  ctx.fillText(`REC  ${mm}:${ss}`, 124, 102);

  ctx.font = "500 64px Newsreader, Georgia, serif";
  ctx.fillText("DRAGONFLY", 72, H - 190);

  ctx.font = "500 28px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#8b968f";
  ctx.fillText(
    `${tel.modeText}   ALT ${tel.altRel.toFixed(0)} m   SPD ${tel.groundSpeed.toFixed(1)}   DST ${Math.hypot(
      (tel.lat - s.operator.lat) * 111320,
      (tel.lng - s.operator.lng) * 111320 * Math.cos((tel.lat * Math.PI) / 180),
    ).toFixed(0)} m`,
    72,
    H - 128,
  );
  ctx.fillStyle = s.locked ? "#7d9a84" : "#8b968f";
  ctx.fillText(s.locked ? "LOCKED ON YOU" : tel.inAir ? "ACQUIRING" : "ON DECK", 72, H - 84);
  ctx.fillStyle = "#6a736e";
  ctx.font = "500 22px 'IBM Plex Mono', monospace";
  ctx.fillText("Johnnie Alderman  ·  KRACKERJACK", 72, H - 44);
}

function drawInstruments(ctx: CanvasRenderingContext2D) {
  const s = useStation.getState();
  ctx.fillStyle = "#090c0b";
  ctx.fillRect(0, 0, W, H);
  const origin = s.operator;
  const scale = 14;
  const to = (lat: number, lng: number) => {
    const x = W / 2 + (lng - origin.lng) * 111320 * Math.cos((origin.lat * Math.PI) / 180) * scale;
    const y = H / 2 - (lat - origin.lat) * 111320 * scale;
    return { x, y };
  };
  const you = to(s.operator.lat, s.operator.lng);
  const ac = to(s.telemetry.lat, s.telemetry.lng);
  trail.push(ac);
  if (trail.length > 240) trail.shift();
  ctx.strokeStyle = "#7d9a84";
  ctx.lineWidth = 6;
  ctx.beginPath();
  trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = "#c5cdc8";
  ctx.setLineDash([14, 16]);
  ctx.beginPath();
  ctx.moveTo(you.x, you.y);
  ctx.lineTo(ac.x, ac.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#e8eeea";
  ctx.beginPath();
  ctx.arc(you.x, you.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7d9a84";
  ctx.beginPath();
  ctx.arc(ac.x, ac.y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6a736e";
  ctx.font = "500 28px 'IBM Plex Mono', monospace";
  ctx.fillText("NO CAMERA  ·  INSTRUMENT TAPE", 72, 180);
}

function tick() {
  const ctx = canvas?.getContext("2d");
  if (!ctx || !canvas) return;
  raf = requestAnimationFrame(tick);
  if (videoEl && videoEl.readyState >= 2) {
    ctx.fillStyle = "#090c0b";
    ctx.fillRect(0, 0, W, H);
    cover(ctx, videoEl);
  } else {
    drawInstruments(ctx);
  }
  drawHud(ctx);
  const now = performance.now();
  if (now - lastClock > 250) {
    lastClock = now;
    useStation.getState().setTape({ tapeMs: now - startedAt });
  }
}

function teardown() {
  cancelAnimationFrame(raf);
  raf = 0;
  recorder = null;
  mix?.getTracks().forEach((t) => t.stop());
  cam?.getTracks().forEach((t) => t.stop());
  mix = null;
  cam = null;
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl.remove();
    videoEl = null;
  }
  canvas?.remove();
  canvas = null;
  trail = [];
}

export async function startTape() {
  if (recorder) return;
  if (typeof MediaRecorder === "undefined") {
    useStation.getState().setTape({
      tapePhase: "idle",
      tapeNote: "This browser cannot record video",
    });
    return;
  }
  useStation.getState().setTape({ tapePhase: "arming", tapeNote: "Arming camera and mic", tapeMs: 0 });
  try {
  cam = await acquire();
  const hasCam = cam.getVideoTracks().length > 0;
  const hasMic = cam.getAudioTracks().length > 0;

  canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  document.body.appendChild(canvas);
  const view = canvas.captureStream(30);
  if (hasCam) {
    videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("playsinline", "true");
    videoEl.setAttribute("aria-hidden", "true");
    videoEl.style.position = "fixed";
    videoEl.style.left = "-9999px";
    videoEl.srcObject = new MediaStream(cam.getVideoTracks());
    document.body.appendChild(videoEl);
    await videoEl.play().catch(() => undefined);
  }
  mix = new MediaStream([...view.getVideoTracks(), ...cam.getAudioTracks()]);
  const mime = pickMime();
  recorder = mime ? new MediaRecorder(mix, { mimeType: mime, videoBitsPerSecond: 8_000_000 }) : new MediaRecorder(mix);
  chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onerror = () => {
    useStation.getState().setTape({ tapePhase: "idle", tapeNote: "Tape failed" });
    teardown();
  };
  startedAt = performance.now();
  lastClock = startedAt;
  trail = [];
  recorder.start(1000);
  tick();
  useStation.getState().setTape({
    tapePhase: "rec",
    tapeCam: hasCam,
    tapeMic: hasMic,
    tapeMs: 0,
    tapeNote: hasCam && hasMic ? "Camera and mic" : hasCam ? "Camera, no mic" : hasMic ? "Mic, instrument tape" : "Instrument tape",
  });
  useStation.getState().pushLog(hasCam ? "Tape rolling" : "Tape rolling · no camera");
  } catch {
    teardown();
    useStation.getState().setTape({
      tapePhase: "idle",
      tapeNote: "Camera or mic was blocked",
    });
  }
}

export function stopTape(): Promise<Clip | null> {
  return new Promise((resolve) => {
    const rec = recorder;
    if (!rec || rec.state === "inactive") {
      teardown();
      useStation.getState().setTape({ tapePhase: "idle" });
      resolve(clip);
      return;
    }
    rec.onstop = () => {
      const type = rec.mimeType || "video/webm";
      const blob = new Blob(chunks, { type });
      if (clip?.url) URL.revokeObjectURL(clip.url);
      const ext = type.includes("mp4") ? "mp4" : "webm";
      clip = {
        blob,
        url: URL.createObjectURL(blob),
        name: `dragonfly-${Date.now()}.${ext}`,
        hasCam: Boolean(cam?.getVideoTracks().length),
        hasMic: Boolean(cam?.getAudioTracks().length),
      };
      teardown();
      useStation.getState().setTape({ tapePhase: "idle", tapeNote: "Tape in the bay" });
      useStation.getState().pushLog("Tape saved");
      useStation.getState().setShareOpen(true);
      resolve(clip);
    };
    rec.stop();
  });
}

export async function toggleTape() {
  const phase = useStation.getState().tapePhase;
  if (phase === "rec" || phase === "arming") await stopTape();
  else await startTape();
}
