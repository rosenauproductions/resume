import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { buildChatIdentifyContext } from "@/lib/db/visitor-identify";

export const runtime = "nodejs";

/**
 * Always-available identify/lead prompt for chat
 * (contact fallback + link-this-visit-to-a-job).
 */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { fingerprint?: string; visitId?: string | null } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fingerprint = (body.fingerprint || "").trim();
  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint required" }, { status: 400 });
  }

  try {
    const ctx = await buildChatIdentifyContext({
      deviceId: fingerprint,
      visitId: body.visitId?.trim() || null,
    });
    return NextResponse.json({
      prompt: ctx.prompt,
      needsLink: ctx.needsLink,
      suggestedLabel: ctx.suggestedLabel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
