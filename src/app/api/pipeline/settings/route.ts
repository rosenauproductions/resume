import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import {
  getPipelineSettingsSnapshot,
  setPipelineHomeDismissed,
  setVisitorIdentifyEnabled,
} from "@/lib/db/settings";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const settings = await getPipelineSettingsSnapshot();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("settings get failed", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: {
    visitorIdentifyEnabled?: boolean;
    dismissedPanels?: string[];
    restoreHomePanels?: boolean;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (typeof body.visitorIdentifyEnabled === "boolean") {
      await setVisitorIdentifyEnabled(body.visitorIdentifyEnabled);
    }
    if (body.restoreHomePanels) {
      await setPipelineHomeDismissed([]);
    } else if (Array.isArray(body.dismissedPanels)) {
      await setPipelineHomeDismissed(
        body.dismissedPanels.filter((p): p is string => typeof p === "string"),
      );
    }

    const settings = await getPipelineSettingsSnapshot();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("settings patch failed", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
