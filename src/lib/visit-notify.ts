/**
 * Shared Discord / ntfy helpers for visit + identify events.
 */

export type VisitNotifyKind = "visit" | "pipeline" | "identify" | "lead";

function tagsFor(kind: VisitNotifyKind) {
  switch (kind) {
    case "pipeline":
      return "lock,briefcase";
    case "lead":
      return "star,briefcase";
    case "identify":
      return "speech_balloon,bust_in_silhouette";
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
  topic: string,
  title: string,
  message: string,
  kind: VisitNotifyKind,
  priority: "default" | "high" = "default",
) {
  const token = process.env.VISIT_NOTIFY_NTFY_TOKEN;
  const url = `https://ntfy.sh/${encodeURIComponent(topic)}`;
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

export async function notifyVisitChannels(input: {
  title: string;
  lines: string[];
  kind?: VisitNotifyKind;
  priority?: "default" | "high";
}): Promise<boolean> {
  const discordWebhook = process.env.VISIT_NOTIFY_DISCORD_WEBHOOK;
  const ntfyTopic = process.env.VISIT_NOTIFY_NTFY_TOPIC;
  if (!discordWebhook && !ntfyTopic) return false;

  const kind = input.kind ?? "visit";
  const plain = input.lines.map((l) => l.replace(/\*\*/g, "")).join("\n");
  const jobs: Promise<unknown>[] = [];
  if (discordWebhook) {
    jobs.push(notifyDiscord(discordWebhook, input.title, input.lines, kind));
  }
  if (ntfyTopic) {
    jobs.push(notifyNtfy(ntfyTopic, input.title, plain, kind, input.priority ?? "default"));
  }
  await Promise.all(jobs);
  return true;
}
