import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHANNELS,
  channelHref,
  composeCaption,
  copyText,
  downloadBlob,
  loadPosts,
  renderShareCard,
  savePosts,
  shareSystem,
  snapshotFlight,
  type CaptionKind,
  type ChannelId,
  type FlightSnapshot,
  type SharePost,
} from "@/gcs/share";
import { useStation } from "@/gcs/store";
import { cn } from "@/lib/cn";

const KINDS: { id: CaptionKind; label: string }[] = [
  { id: "lock", label: "Lock" },
  { id: "airborne", label: "Airborne" },
  { id: "orbit", label: "Orbit" },
  { id: "recap", label: "Recap" },
];

function capture(): FlightSnapshot {
  const s = useStation.getState();
  return snapshotFlight(s.telemetry, s.operator, s.flightMode, s.locked, s.linkKind, s.flightStartedAt);
}

export function ShareSheet() {
  const open = useStation((s) => s.shareOpen);
  const [snap, setSnap] = useState<FlightSnapshot | null>(null);
  const [kind, setKind] = useState<CaptionKind>("lock");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState<ChannelId | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeOk, setNoticeOk] = useState(true);
  const [posts, setPosts] = useState<SharePost[]>([]);

  useEffect(() => {
    if (!open) return;
    const shot = capture();
    const nextKind = shot.inAir ? (shot.mode === "orbit" ? "orbit" : "lock") : "recap";
    setSnap(shot);
    setKind(nextKind);
    setCaption(composeCaption(nextKind, shot));
    setPosts(loadPosts());
    setNotice("");
    setBusy(null);
  }, [open]);

  function applyKind(next: CaptionKind) {
    setKind(next);
    if (snap) setCaption(composeCaption(next, snap));
  }

  function refresh() {
    const shot = capture();
    setSnap(shot);
    setCaption(composeCaption(kind, shot));
    setNotice("Caption pulled from the aircraft now");
    setNoticeOk(true);
  }

  async function send(id: ChannelId) {
    if (!snap) return;
    setBusy(id);
    setNotice("");
    try {
      if (id === "copy") {
        await copyText(caption);
        setNotice("Caption copied");
        setNoticeOk(true);
      } else if (id === "card") {
        const blob = await renderShareCard(snap);
        downloadBlob(blob, `dragonfly-${Date.now()}.png`);
        try {
          await copyText(caption);
          setNotice("Still saved · caption copied — paste both into Instagram or TikTok");
        } catch {
          setNotice("Still saved — copy the caption if paste is needed");
        }
        setNoticeOk(true);
      } else if (id === "system") {
        let file: File | undefined;
        try {
          const blob = await renderShareCard(snap);
          file = new File([blob], "dragonfly.png", { type: "image/png" });
        } catch {
          file = undefined;
        }
        const shared = await shareSystem(caption, file);
        setNotice(shared ? "Share sheet opened" : "Copied — this browser has no system share");
        setNoticeOk(true);
      } else {
        const href = channelHref(id, caption);
        if (href) window.open(href, "_blank", "noopener,noreferrer");
        setNotice(`Opened ${CHANNELS.find((c) => c.id === id)?.name}`);
        setNoticeOk(true);
      }
      const next: SharePost[] = [
        ...posts,
        { id: `${Date.now()}`, t: Date.now(), channel: id, caption },
      ].slice(-24);
      setPosts(next);
      savePosts(next);
      useStation.getState().pushLog(`Posted via ${id}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Share cancelled");
      setNoticeOk(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={useStation.getState().setShareOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-bg/70" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[2010] mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-xl bg-surface shadow-[var(--shadow-border)] focus:outline-none sm:inset-y-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(88dvh,40rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <Dialog.Title className="font-display text-xl font-medium tracking-tight">
                Post
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Caption from this flight. Phone share hits Instagram, TikTok, Facebook. X and Threads open compose.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="shrink-0">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex rounded-lg bg-raised p-1">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => applyKind(k.id)}
                  className={cn(
                    "h-10 flex-1 rounded-md text-sm font-medium",
                    kind === k.id ? "bg-surface text-fg" : "text-muted",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <label className="mt-3 block">
              <span className="sr-only">Caption</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={7}
                className="w-full resize-none rounded-lg bg-raised p-3 text-sm leading-relaxed text-fg shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              />
            </label>
            <div className="mt-1 flex items-center justify-between">
              <button type="button" className="text-xs text-muted" onClick={refresh}>
                Pull live numbers
              </button>
              <p className="font-mono text-[10px] text-subtle">{caption.length} ch</p>
            </div>

            <ul className="mt-2 flex flex-col gap-2">
              {CHANNELS.map((c) => (
                <li key={c.id} className="flex items-start gap-3 rounded-lg bg-raised p-3">
                  <Share2 className="mt-0.5 size-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{c.hint}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={c.id === "system" || c.id === "x" ? "primary" : "secondary"}
                    disabled={busy !== null}
                    onClick={() => void send(c.id)}
                    className="shrink-0"
                  >
                    {busy === c.id ? "…" : c.id === "copy" ? "Copy" : c.id === "card" ? "Save" : "Post"}
                  </Button>
                </li>
              ))}
            </ul>

            {notice ? (
              <p className={cn("mt-3 text-xs", noticeOk ? "text-ok" : "text-warn")}>{notice}</p>
            ) : null}

            {posts.length ? (
              <div className="mt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">This device</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {posts
                    .slice()
                    .reverse()
                    .slice(0, 5)
                    .map((p) => (
                      <li key={p.id} className="text-xs leading-relaxed text-muted">
                        <span className="font-mono uppercase tracking-[0.12em] text-subtle">{p.channel}</span>
                        {" · "}
                        {p.caption.split("\n")[0]}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
