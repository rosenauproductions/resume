import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pushSubscriptions, type PushSubscriptionRow } from "@/lib/db/schema";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

/** Insert a new subscription, or refresh lastSeenAt if this endpoint already exists. */
export async function saveSubscription(input: PushSubscriptionInput) {
  const db = getDb();
  const existing = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, input.endpoint),
  });
  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? existing.userAgent,
        lastSeenAt: new Date(),
      })
      .where(eq(pushSubscriptions.endpoint, input.endpoint));
    return;
  }
  await db.insert(pushSubscriptions).values({
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: input.userAgent ?? "",
  });
}

export async function deleteSubscription(endpoint: string) {
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function listSubscriptions(): Promise<PushSubscriptionRow[]> {
  const db = getDb();
  return db.query.pushSubscriptions.findMany();
}

export async function subscriptionExists(endpoint: string): Promise<boolean> {
  const db = getDb();
  const existing = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, endpoint),
  });
  return Boolean(existing);
}
