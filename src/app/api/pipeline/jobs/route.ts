import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, getTrackerSecret } from "@/lib/jobs/auth";
import { blobConfigured, loadJobsFromBlob, saveJobsToBlob } from "@/lib/jobs/store";
import { normalizeJob, type JobApplication } from "@/lib/jobs/types";

async function requireAuth() {
  if (!getTrackerSecret()) return { ok: false as const, status: 503, error: "Not configured" };
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!blobConfigured()) {
    return NextResponse.json({ jobs: null, storage: "local" });
  }

  const jobs = await loadJobsFromBlob();
  return NextResponse.json({ jobs: jobs ?? [], storage: "blob" });
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!blobConfigured()) {
    return NextResponse.json(
      { error: "Server storage not configured. Jobs are saved in this browser only.", storage: "local" },
      { status: 501 },
    );
  }

  let body: { jobs?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.jobs)) {
    return NextResponse.json({ error: "Expected { jobs: [] }" }, { status: 400 });
  }

  const jobs = body.jobs
    .map((row) => normalizeJob(row))
    .filter((j): j is JobApplication => Boolean(j));

  await saveJobsToBlob(jobs);
  return NextResponse.json({ ok: true, count: jobs.length, storage: "blob" });
}
