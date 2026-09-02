import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { listApplications } from "@/lib/db/applications";
import { getVisit, linkVisit, listVisits } from "@/lib/db/visits";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export async function GET() {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured", visits: [] }, { status: 501 });
  }

  const [visits, jobs] = await Promise.all([listVisits(150), listApplications()]);
  const byId = new Map(jobs.map((j) => [j.id, j]));

  return NextResponse.json({
    visits: visits.map((v) => ({
      ...v,
      linkedJob: v.linkedApplicationId ? byId.get(v.linkedApplicationId) ?? null : null,
    })),
    jobs: jobs.map((j) => ({ id: j.id, company: j.company, title: j.title, location: j.location })),
    storage: "db",
  });
}

export async function POST(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  let body: {
    visitId?: string;
    action?: "confirm" | "ignore" | "link";
    applicationId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.visitId || !body.action) {
    return NextResponse.json({ error: "Expected visitId and action" }, { status: 400 });
  }

  const existing = await getVisit(body.visitId);
  if (!existing) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  try {
    const visit = await linkVisit(body.visitId, body.action, body.applicationId);
    return NextResponse.json({ ok: true, visit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Link failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
