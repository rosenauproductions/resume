import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { listOpenApplicationsForAssociation } from "@/lib/db/applications";
import { getVisitorIdentification } from "@/lib/db/visitor-identify";
import type { IdentifyPromptPayload } from "@/lib/visit-identify-types";

export const runtime = "nodejs";

/**
 * Always-available identify/lead prompt for chat fallback
 * ("mind if I let Chris know who you are?").
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
    const apps = await listOpenApplicationsForAssociation();
    const positions = apps.map((a) => ({
      id: a.id,
      company: a.company,
      title: a.title,
    }));
    const existing = await getVisitorIdentification(fingerprint);
    const prompt: IdentifyPromptPayload = {
      show: true,
      mode: existing ? "welcome" : "identify",
      visitId: body.visitId?.trim() || null,
      suggested: null,
      known: existing
        ? {
            applicationId: existing.applicationId,
            company: existing.leadCompany || "",
            title: existing.leadTitle || "",
            freeText: existing.freeText || "",
            contactName: existing.contactName || "",
            label:
              existing.contactName ||
              existing.leadCompany ||
              existing.leadTitle ||
              "a guest",
          }
        : null,
      positions,
    };
    return NextResponse.json({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
