import { createServerFn } from "@tanstack/react-start";
import { parseWingJson, type WingBrief, type WingOrder } from "./pilot";

const SYSTEM = `You are WING, the outer-loop copilot in DRAGONFLY, a follow-me ground station by Johnnie Alderman (KRACKERJACK support).
The inner loop is PX4/ArduPilot or a preview twin. You only choose follow geometry and modes.
Rules:
- Reply with ONE JSON object, no markdown: {"say":"short radio call ≤12 words","mode":"follow"|"orbit"|"hover"|"lead"|"rtl"|null,"follow":{"distanceM":n,"heightM":n,"orbitRadiusM":n}|null,"action":"none"|"takeoff"|"land"|"rtl"}
- Never takeoff or land unless the operator asked in this message.
- Battery ≤20 or lost link: rtl or hover. Be conservative. Do not invent obstacles.
- Default is follow behind the phone. Orbit if they stop and want a shot. Lead if they ask to film ahead.
- say is ATC-plain, no slang, no emoji.`;

export const askWing = createServerFn({ method: "POST" })
  .validator((input: { brief: WingBrief }) => input)
  .handler(async ({ data }): Promise<{ ok: true; order: WingOrder } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "WING is dark in this environment" };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 220,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify(data.brief),
          },
        ],
      }),
    });

    if (!res.ok) return { ok: false, error: `WING radio ${res.status}` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    const order = parseWingJson(text);
    if (!order) return { ok: false, error: "WING gave an unreadable call" };
    return { ok: true, order };
  });
