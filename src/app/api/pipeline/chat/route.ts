import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { deleteChatTurns, listChatTurns } from "@/lib/db/chat";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export async function GET(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured", turns: [] }, { status: 501 });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") || "200");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200;
  const identifiedOnly = url.searchParams.get("identified") === "1";

  try {
    let turns = await listChatTurns(limit);
    if (identifiedOnly) {
      turns = turns.filter((t) => Boolean(t.visitor || t.linkedJob));
    }
    return NextResponse.json({ turns, storage: "db" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load chat";
    return NextResponse.json({ error: message, turns: [] }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  try {
    const deleted = await deleteChatTurns(ids);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
