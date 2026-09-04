import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { saveVisitorIdentification, type VisitorLeadInput } from "@/lib/db/visitor-identify";
import { identifyDoneCookieHeaderValue } from "@/lib/identify-persistence";

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
    lead?: VisitorLeadInput | null;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await saveVisitorIdentification({
      deviceId: body.fingerprint || "",
      applicationId: body.applicationId,
      freeText: body.freeText,
      confirmedSuggested: body.confirmedSuggested,
      visitId: body.visitId,
      lead: body.lead ?? null,
    });
    const res = NextResponse.json(result);
    res.headers.append("Set-Cookie", identifyDoneCookieHeaderValue());
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
