import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import {
  createCopilotItem,
  listCopilotItems,
  type CopilotItemKind,
  type CopilotItemStatus,
} from "@/lib/db/copilot";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

const VALID_KINDS: CopilotItemKind[] = ["flag", "request"];
const VALID_STATUSES: CopilotItemStatus[] = ["pending", "handled", "done", "blocked"];

export async function GET(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured", items: [] }, { status: 501 });
  }

  const url = new URL(request.url);
  const kindRaw = url.searchParams.get("kind") || undefined;
  const statusRaw = url.searchParams.get("status") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const limitRaw = Number(url.searchParams.get("limit") || "100");

  const kind = kindRaw && VALID_KINDS.includes(kindRaw as CopilotItemKind) ? (kindRaw as CopilotItemKind) : undefined;
  const status =
    statusRaw && VALID_STATUSES.includes(statusRaw as CopilotItemStatus)
      ? (statusRaw as CopilotItemStatus)
      : undefined;

  try {
    const items = await listCopilotItems({
      kind,
      status,
      category,
      limit: Number.isFinite(limitRaw) ? limitRaw : 100,
    });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load items";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 501 });
  }

  let body: {
    kind?: string;
    category?: string;
    title?: string;
    body?: string;
    sourceLink?: string;
    requestType?: string;
    calendarEvent?: {
      title: string;
      date: string;
      time: string;
      location: string;
      notes: string;
    } | null;
    createdBy?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.kind || !VALID_KINDS.includes(body.kind as CopilotItemKind)) {
    return NextResponse.json({ error: 'kind must be "flag" or "request"' }, { status: 400 });
  }
  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const item = await createCopilotItem({
      kind: body.kind as CopilotItemKind,
      category: body.category,
      title: body.title,
      body: body.body,
      sourceLink: body.sourceLink,
      requestType: body.requestType,
      calendarEvent: body.calendarEvent ?? null,
      createdBy: body.createdBy,
    });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
