/**
 * Shared Discord / ntfy / email helpers for visit + identify events.
 */

import { resolveNtfyNotifyConfig } from "@/lib/db/settings";

export type VisitNotifyKind = "visit" | "visit_ai" | "pipeline" | "identify" | "lead";

function tagsFor(kind: VisitNotifyKind) {
  switch (kind) {
    case "pipeline":
      return "lock,briefcase";
    case "lead":
      return "star,briefcase";
    case "identify":
      return "speech_balloon,bust_in_silhouette";
    case "visit_ai":
      return "robot,globe_with_meridians";
    default:
      return "eyes,globe_with_meridians";
  }
}

function colorFor(kind: VisitNotifyKind) {
  switch (kind) {
    case "pipeline":
      return 0xe8a35c;
    case "lead":
      return 0xf0c14a;
    case "identify":
      return 0x7cb8ff;
    case "visit_ai":
      return 0x6c8cff;
    default:
      return 0x3fd0c9;
  }
}

async function notifyDiscord(webhook: string, title: string, lines: string[], kind: VisitNotifyKind) {
  const body = {
    embeds: [
      {
        title,
        description: lines.join("\n"),
        color: colorFor(kind),
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

async function notifyNtfy(
  server: string,
  topic: string,
  title: string,
  message: string,
  kind: VisitNotifyKind,
  priority: "default" | "high" = "default",
) {
  const token = process.env.VISIT_NOTIFY_NTFY_TOKEN;
  const base = server.replace(/\/$/, "");
  const url = `${base}/${encodeURIComponent(topic)}`;
  const baseHeaders: Record<string, string> = {
    Title: title,
    Priority: priority,
    Tags: tagsFor(kind),
  };

  const post = (headers: Record<string, string>) =>
    fetch(url, { method: "POST", headers, body: message });

  let res = await post(
    token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders,
  );

  if (res.status === 401 || res.status === 403) {
    res = await post(baseHeaders);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ntfy ${res.status}: ${text}`);
  }
}

/** Turns our `**Label:** value` line format into a simple HTML block for email. */
function linesToHtml(lines: string[]): string {
  const rows = lines
    .map((line) => {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      // Restore bold markers after escaping, then convert **label:** → <strong>
      const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p style="margin:0 0 8px 0;">${withBold}</p>`;
    })
    .join("\n");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#1a1a1a;">${rows}</div>`;
}

async function notifyEmail(
  apiKey: string,
  from: string,
  to: string,
  title: string,
  lines: string[],
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Resume site — ${title}`,
      html: linesToHtml(lines),
      text: lines.map((l) => l.replace(/\*\*/g, "")).join("\n"),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`resend ${res.status}: ${text}`);
  }
}

export async function notifyVisitChannels(input: {
  title: string;
  lines: string[];
  kind?: VisitNotifyKind;
  priority?: "default" | "high";
}): Promise<boolean> {
  const discordWebhook = process.env.VISIT_NOTIFY_DISCORD_WEBHOOK;
  const { topic: ntfyTopic, server: ntfyServer } = await resolveNtfyNotifyConfig();

  const kind = input.kind ?? "visit";

  // Email only fires for real leads (contact form submissions) — visits/identify
  // pings stay on Discord/ntfy so the inbox doesn't fill up with page-view noise.
  const resendApiKey = kind === "lead" ? process.env.RESEND_API_KEY?.trim() : undefined;
  const emailTo = process.env.VISIT_NOTIFY_EMAIL_TO?.trim() || "rosenauproductions@gmail.com";
  const emailFrom = process.env.VISIT_NOTIFY_EMAIL_FROM?.trim() || "Resume Leads <onboarding@resend.dev>";

  if (!discordWebhook && !ntfyTopic && !resendApiKey) return false;

  const plain = input.lines.map((l) => l.replace(/\*\*/g, "")).join("\n");
  const jobs: Promise<unknown>[] = [];
  if (discordWebhook) {
    jobs.push(notifyDiscord(discordWebhook, input.title, input.lines, kind));
  }
  if (ntfyTopic) {
    jobs.push(
      notifyNtfy(ntfyServer, ntfyTopic, input.title, plain, kind, input.priority ?? "default"),
    );
  }
  if (resendApiKey) {
    jobs.push(notifyEmail(resendApiKey, emailFrom, emailTo, input.title, input.lines));
  }
  await Promise.all(jobs);
  return true;
}
