import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import {
  createApplication,
  getApplication,
  listApplications,
  replaceAllApplications,
} from "@/lib/db/applications";
import {
  getBackupJobs,
  listBackups,
  listTrash,
  saveBackup,
  takeFromTrash,
} from "@/lib/db/app-backups";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export const runtime = "nodejs";

/** List snapshots + trash (deleted applications). */
export async function GET() {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const [backups, trash] = await Promise.all([listBackups(), listTrash()]);
  return NextResponse.json({
    backups,
    trash: trash.map((t) => ({
      deletedAt: t.deletedAt,
      id: t.job.id,
      company: t.job.company,
      title: t.job.title,
      status: t.job.status,
    })),
  });
}

/**
 * Actions:
 *   { action: "create" }                 → snapshot now
 *   { action: "restore", id }            → snapshot current, then restore that snapshot
 *   { action: "restoreTrash", jobId }    → put one deleted application back
 */
export async function POST(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { action?: string; id?: string; jobId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.action === "create") {
      const current = await listApplications();
      const id = await saveBackup(current, "Manual backup", { force: true });
      return NextResponse.json({ ok: true, id, count: current.length });
    }

    if (body.action === "restore") {
      const jobs = body.id ? await getBackupJobs(body.id) : null;
      if (!jobs?.length) return NextResponse.json({ error: "Backup not found" }, { status: 404 });
      const current = await listApplications();
      await saveBackup(current, `Auto: before restoring ${body.id?.split(":").slice(1).join(":")}`, {
        force: true,
      });
      const count = await replaceAllApplications(jobs, { skipBackup: true });
      return NextResponse.json({ ok: true, count, jobs: await listApplications() });
    }

    if (body.action === "restoreTrash") {
      if (!body.jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
      if (await getApplication(body.jobId)) {
        return NextResponse.json({ error: "That application already exists" }, { status: 409 });
      }
      const job = await takeFromTrash(body.jobId);
      if (!job) return NextResponse.json({ error: "Not in trash" }, { status: 404 });
      const restored = await createApplication(job);
      return NextResponse.json({ ok: true, job: restored });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("pipeline backup action failed", error);
    return NextResponse.json({ error: "Backup action failed" }, { status: 500 });
  }
}
