import webpush from "web-push";
import { deleteSubscription, listSubscriptions } from "./subscriptions";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:rosenauproductions@gmail.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

/**
 * Sends a push notification to every subscribed device. Dead subscriptions
 * (410 Gone / 404) are pruned automatically. Never throws — returns a
 * summary so callers (including the hourly bot) can report it plainly.
 */
export async function sendPushToAll(payload: PushPayload) {
  if (!ensureVapid()) {
    return { ok: false as const, error: "VAPID keys not configured", sent: 0, failed: 0, pruned: 0 };
  }

  const subs = await listSubscriptions();
  if (subs.length === 0) {
    return { ok: true as const, sent: 0, failed: 0, pruned: 0, note: "No devices subscribed yet" };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/pipeline",
    tag: payload.tag || "resume-pipeline",
  });

  let sent = 0;
  let failed = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        sent += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deleteSubscription(sub.endpoint).catch(() => {});
          pruned += 1;
        } else {
          failed += 1;
        }
      }
    }),
  );

  return { ok: true as const, sent, failed, pruned };
}
