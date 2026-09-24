import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { updateCopilotItemStatus, type CopilotItemStatus } from "@/lib/db/copilot";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

const VALID_STATUSES: CopilotItemStatus[] = ["pending", "handled", "done", "blocked"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  const { id } = await params;

  let body: { status?: string; resultNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as CopilotItemStatus)) {
    return NextResponse.json({ error: "status must be one of pending/handled/done/blocked" }, { status: 400 });
  }

  try {
    const item = await updateCopilotItemStatus(id, {
      status: body.status as CopilotItemStatus,
      resultNote: body.resultNote,
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
