import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type VisitPayload = {
  path?: string;
  referrer?: string;
  language?: string;
  screen?: string;
  timezone?: string;
};

function pickHeader(req: NextRequest, name: string) {
  return req.headers.get(name)?.trim() || "";
}

function summarizeUa(ua: string) {
  if (!ua) return "Unknown device";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Desktop / other";
}

function titleForPath(path: string) {
  if (path === "/pipeline" || path.startsWith("/pipeline/")) {
    return "Pipeline visited";
  }
  return "Resume site visit";
}

async function notifyDiscord(webhook: string, title: string, lines: string[]) {
  const body = {
    embeds: [
      {
        title,
        description: lines.join("\n"),
        color: title.startsWith("Pipeline") ? 0xe8a35c : 0x3fd0c9,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function notifyNtfy(topic: string, title: string, message: string) {
  const token = process.env.VISIT_NOTIFY_NTFY_TOKEN;
  const url = `https://ntfy.sh/${encodeURIComponent(topic)}`;
  const tags = title.startsWith("Pipeline")
    ? "lock,briefcase"
    : "eyes,globe_with_meridians";
  const baseHeaders: Record<string, string> = {
    Title: title,
    Priority: "default",
    Tags: tags,
  };

  const post = (headers: Record<string, string>) =>
    fetch(url, { method: "POST", headers, body: message });

  let res = await post(
    token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders,
  );

  // Token may be invalid for public topics — fall back to unauthenticated publish
  if (res.status === 401 || res.status === 403) {
    res = await post(baseHeaders);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ntfy ${res.status}: ${text}`);
  }
}

export async function POST(req: NextRequest) {
  const discordWebhook = process.env.VISIT_NOTIFY_DISCORD_WEBHOOK;
  const ntfyTopic = process.env.VISIT_NOTIFY_NTFY_TOPIC;

  if (!discordWebhook && !ntfyTopic) {
    return NextResponse.json(
      { ok: false, error: "No notification channel configured" },
      { status: 503 },
    );
  }

  let payload: VisitPayload = {};
  try {
    payload = (await req.json()) as VisitPayload;
  } catch {
    // ignore empty body
  }

  const city = pickHeader(req, "x-vercel-ip-city");
  const region = pickHeader(req, "x-vercel-ip-country-region");
  const country = pickHeader(req, "x-vercel-ip-country");
  const ua = pickHeader(req, "user-agent");
  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const location =
    [decodeURIComponent(city || ""), region, country].filter(Boolean).join(", ") ||
    "Unknown location";

  const lines = [
    `**When:** ${when} (Central)`,
    `**Where:** ${location}`,
    `**Device:** ${summarizeUa(ua)}`,
    `**Page:** ${payload.path || "/"}`,
    payload.referrer ? `**From:** ${payload.referrer}` : null,
    payload.timezone ? `**Visitor TZ:** ${payload.timezone}` : null,
    payload.language ? `**Language:** ${payload.language}` : null,
    payload.screen ? `**Screen:** ${payload.screen}` : null,
  ].filter(Boolean) as string[];

  const plain = lines.map((l) => l.replace(/\*\*/g, "")).join("\n");
  const title = titleForPath(payload.path || "/");

  try {
    const jobs: Promise<unknown>[] = [];
    if (discordWebhook) jobs.push(notifyDiscord(discordWebhook, title, lines));
    if (ntfyTopic) {
      jobs.push(notifyNtfy(ntfyTopic, title, plain));
    }
    await Promise.all(jobs);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("visit notify failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
