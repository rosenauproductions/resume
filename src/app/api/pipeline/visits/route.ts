import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { listApplications } from "@/lib/db/applications";
import {
  addIgnoredDevice,
  deleteVisit,
  deleteVisits,
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
  const ids: string[] = [];
  const single = (searchParams.get("id") || "").trim();
  const multi = (searchParams.get("ids") || "").trim();
  if (single) ids.push(single);
  if (multi) {
    for (const part of multi.split(",")) {
      const id = part.trim();
      if (id) ids.push(id);
    }
  }
  if (!ids.length) {
    try {
      const body = (await request.json()) as { ids?: unknown; id?: unknown };
      if (typeof body.id === "string" && body.id.trim()) ids.push(body.id.trim());
      if (Array.isArray(body.ids)) {
        for (const raw of body.ids) {
          if (typeof raw === "string" && raw.trim()) ids.push(raw.trim());
        }
      }
    } catch {
      // no body
    }
  }

  const unique = [...new Set(ids)];
  if (!unique.length) {
    return NextResponse.json({ error: "Expected id, ids, or JSON { ids: [] }" }, { status: 400 });
  }

  if (unique.length === 1) {
    const existing = await getVisit(unique[0]);
    if (!existing) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }
    const ok = await deleteVisit(unique[0]);
    if (!ok) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deletedIds: [unique[0]] });
  }

  const deletedIds = await deleteVisits(unique);
  return NextResponse.json({
    ok: true,
    deletedIds,
    requested: unique.length,
    deleted: deletedIds.length,
  });
}
