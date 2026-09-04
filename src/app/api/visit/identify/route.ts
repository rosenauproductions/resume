import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { saveVisitorIdentification } from "@/lib/db/visitor-identify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: {
    fingerprint?: string;
    applicationId?: string | null;
    freeText?: string;
    confirmedSuggested?: boolean;
    visitId?: string | null;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await saveVisitorIdentification({
      deviceId: body.fingerprint || "",
      applicationId: body.applicationId,
      freeText: body.freeText,
      confirmedSuggested: body.confirmedSuggested,
      visitId: body.visitId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
