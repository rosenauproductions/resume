import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { dbConfigured } from "@/lib/db";
import {
  getResumeContent,
  resetResumeContent,
  saveResumeContent,
} from "@/lib/db/resume-content";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const content = await getResumeContent();
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    console.error("resume get failed", error);
    return NextResponse.json({ error: "Failed to load resume content" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { content?: unknown; reset?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const content = body.reset
      ? await resetResumeContent()
      : await saveResumeContent(body.content);
    revalidatePath("/");
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    console.error("resume save failed", error);
    return NextResponse.json({ error: "Failed to save resume content" }, { status: 500 });
  }
}
