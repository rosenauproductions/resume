import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";
import { deleteSubscription, saveSubscription } from "@/lib/push/subscriptions";

type SubscribeBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

/** Called from the browser (on the password-gated /pipeline page) after the
 * visitor grants Notification permission and subscribes via the service
 * worker's PushManager. Stores the subscription so /api/push/send can reach
 * this device later. */
export async function POST(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Expected {endpoint, keys:{p256dh, auth}}" }, { status: 400 });
  }

  await saveSubscription({
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    userAgent: request.headers.get("user-agent") || "",
  });

  return NextResponse.json({ ok: true });
}

/** Unsubscribe — called when the visitor turns notifications off on this device. */
export async function DELETE(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "Expected {endpoint}" }, { status: 400 });
  }

  await deleteSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
