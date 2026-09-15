import { createFileRoute } from "@tanstack/react-router";
import { Preflight } from "@/components/station/Preflight";
import { Station } from "@/components/station/Station";
import { useStation } from "@/gcs/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const phase = useStation((s) => s.phase);
  return phase === "preflight" ? <Preflight /> : <Station />;
}
