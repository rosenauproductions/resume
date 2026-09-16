import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";
import { pushConfigured, sendPushToAll } from "@/lib/push/send";

type SendBody = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

/**
 * Sends a push notification to every device that has enabled pipeline
 * notifications (added the site to their homescreen / granted permission
 * on /pipeline). This is what the hourly email-sync bot calls when it
 * decides Chris should know something right away — same auth as the rest
 * of the pipeline API: POST /api/pipeline/login first to get the
 * pipeline_session cookie, then send that cookie here.
 *
 * Always returns 200 with a summary (even "no devices subscribed yet" or
 * "not configured") rather than an error a caller might treat as fatal —
 * a failed/unconfigured notification should never block the rest of a run.
 */
export async function POST(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);

  if (!dbConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not configured", sent: 0 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ ok: false, error: "VAPID keys not configured", sent: 0 });
  }

  let body: SendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || !body.body) {
    return NextResponse.json({ error: "Expected {title, body}" }, { status: 400 });
  }

  const result = await sendPushToAll({
    title: body.title,
    body: body.body,
    url: body.url,
    tag: body.tag,
  });

  return NextResponse.json(result);
}
