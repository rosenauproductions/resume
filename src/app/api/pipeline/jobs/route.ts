import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import {
  createApplication,
  deleteApplication,
  listApplications,
  replaceAllApplications,
  updateApplication,
  upsertApplications,
} from "@/lib/db/applications";
import { blobConfigured, loadJobsFromBlob, saveJobsToBlob } from "@/lib/jobs/store";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";
import { normalizeJob, type JobApplication } from "@/lib/jobs/types";

export async function GET() {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);

  if (dbConfigured()) {
    const jobs = await listApplications();
    return NextResponse.json({ jobs, storage: "db", count: jobs.length });
  }

  if (!blobConfigured()) {
    return NextResponse.json({ jobs: null, storage: "local" });
  }

  const jobs = await loadJobsFromBlob();
  return NextResponse.json({ jobs: jobs ?? [], storage: "blob" });
}

export async function POST(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  let body: { job?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const job = normalizeJob(body.job ?? body);
  if (!job) {
    return NextResponse.json({ error: "Expected a job object" }, { status: 400 });
  }

  const created = await createApplication(job);
  return NextResponse.json({ ok: true, job: created, storage: "db" });
}

export async function PUT(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);

  let body: {
    jobs?: unknown;
    job?: unknown;
    mode?: "replace" | "upsert" | "update";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Single-job update
  if (body.job && !Array.isArray(body.jobs)) {
    if (!dbConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
    }
    const job = normalizeJob(body.job);
    if (!job?.id) {
      return NextResponse.json({ error: "Expected job with id" }, { status: 400 });
    }
    const updated = await updateApplication(job.id, job);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, job: updated, storage: "db" });
  }

  if (!Array.isArray(body.jobs)) {
    return NextResponse.json({ error: "Expected { jobs: [] }" }, { status: 400 });
  }

  const jobs = body.jobs
    .map((row) => normalizeJob(row))
    .filter((j): j is JobApplication => Boolean(j));

  if (dbConfigured()) {
    const mode = body.mode === "upsert" ? "upsert" : "replace";
    if (mode === "upsert") {
      const result = await upsertApplications(jobs);
      const all = await listApplications();
      return NextResponse.json({
        ok: true,
        count: all.length,
        ...result,
        jobs: all,
        storage: "db",
      });
    }
    const count = await replaceAllApplications(jobs);
    return NextResponse.json({ ok: true, count, jobs, storage: "db" });
  }

  if (!blobConfigured()) {
    return NextResponse.json(
      { error: "Server storage not configured. Jobs are saved in this browser only.", storage: "local" },
      { status: 501 },
    );
  }

  await saveJobsToBlob(jobs);
  return NextResponse.json({ ok: true, count: jobs.length, storage: "blob" });
}

export async function DELETE(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const ok = await deleteApplication(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, storage: "db" });
}
