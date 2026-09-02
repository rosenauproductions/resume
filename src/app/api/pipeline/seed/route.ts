import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { listApplications } from "@/lib/db/applications";
import { completeTrackerMeta, loadJobsFromDrive } from "@/lib/jobs/drive-seed";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";
import { parseTrackerPayload } from "@/lib/jobs/types";
import { upsertApplications, replaceAllApplications } from "@/lib/db/applications";
import { loadSeedJobs, loadSeedMeta } from "@/lib/jobs/seed";

export async function GET() {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);

  try {
    const result = await loadJobsFromDrive();
    return NextResponse.json({
      ...result,
      configured: true,
      count: result.jobs.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Drive seed";
    const configured = !message.includes("not configured");
    return NextResponse.json(
      { error: message, configured },
      { status: configured ? 502 : 501 },
    );
  }
}

/** Import Drive (or posted JSON) into Neon DB. */
export async function POST(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  let body: { source?: "drive" | "bundled" | "json"; payload?: unknown; mode?: "upsert" | "replace" } =
    {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      body = await request.json();
    }
  } catch {
    body = {};
  }

  const mode = body.mode === "replace" ? "replace" : "upsert";
  let jobs;
  let meta;

  try {
    if (body.source === "bundled") {
      jobs = loadSeedJobs();
      meta = loadSeedMeta();
    } else if (body.source === "json" && body.payload) {
      const parsed = parseTrackerPayload(body.payload);
      jobs = parsed.jobs;
      meta = completeTrackerMeta(parsed.meta);
    } else {
      const drive = await loadJobsFromDrive();
      jobs = drive.jobs;
      meta = drive.meta;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!jobs.length) {
    return NextResponse.json({ error: "No applications to import" }, { status: 400 });
  }

  if (mode === "replace") {
    await replaceAllApplications(jobs);
  } else {
    await upsertApplications(jobs);
  }

  const all = await listApplications();
  return NextResponse.json({
    ok: true,
    count: all.length,
    jobs: all,
    meta: meta ?? loadSeedMeta(),
    storage: "db",
    mode,
  });
}
