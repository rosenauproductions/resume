import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { listApplications } from "@/lib/db/applications";
import {
  addIgnoredDevice,
  deleteVisit,
  getVisit,
  linkVisit,
  listVisits,
} from "@/lib/db/visits";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export async function GET() {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured", visits: [] }, { status: 501 });
  }

  const [visits, jobs] = await Promise.all([listVisits(300), listApplications()]);
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
    action?: "confirm" | "ignore" | "link" | "ignore-device";
    applicationId?: string;
    deviceId?: string;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "ignore-device") {
    const deviceId = (body.deviceId || "").trim();
    if (!deviceId) {
      return NextResponse.json({ error: "Expected deviceId" }, { status: 400 });
    }
    try {
      const result = await addIgnoredDevice(deviceId, body.note || "");
      // If a visit was provided, also mark its association ignored
      let visit = null;
      if (body.visitId) {
        visit = await linkVisit(body.visitId, "ignore");
      }
      return NextResponse.json({ ok: true, ignoredDevice: result, visit });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ignore device failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (!body.visitId || !body.action) {
    return NextResponse.json({ error: "Expected visitId and action" }, { status: 400 });
  }

  if (body.action !== "confirm" && body.action !== "ignore" && body.action !== "link") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
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

export async function DELETE(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Expected id query param" }, { status: 400 });
  }

  const existing = await getVisit(id);
  if (!existing) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const ok = await deleteVisit(id);
  if (!ok) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deletedId: id });
}
