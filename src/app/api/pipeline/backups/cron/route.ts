import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { listApplications } from "@/lib/db/applications";
import { saveBackup } from "@/lib/db/app-backups";

export const runtime = "nodejs";

/**
 * Daily snapshot, called by Vercel Cron (see vercel.json). When CRON_SECRET is set,
 * Vercel sends it as a Bearer token; otherwise only the Vercel cron user agent is
 * accepted. A snapshot is skipped when nothing changed since the last one.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authz = request.headers.get("authorization") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const allowed = secret ? authz === `Bearer ${secret}` : ua.startsWith("vercel-cron");
  if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const current = await listApplications();
  const id = await saveBackup(current, "Daily backup");
  return NextResponse.json({ ok: true, id, skipped: !id, count: current.length });
}
