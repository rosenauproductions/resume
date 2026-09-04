import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { dbConfigured } from "@/lib/db";
import {
  getPipelineSettingsSnapshot,
  setFreshVisitPingDurationSec,
  setInsetMapSetting,
  setMetroMapSetting,
  setPipelineHomeDismissed,
  setPipelineHomePanelOrder,
  restorePipelineHomePanels,
  setSiteDeploySetting,
  setSkillsSectionEnabled,
  setVisitorIdentifyEnabled,
  type SiteDeploySetting,
} from "@/lib/db/settings";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export const runtime = "nodejs";

type RegionPatch = {
  label?: string;
  lng0?: number;
  lng1?: number;
  lat0?: number;
  lat1?: number;
} | null;

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
    skillsSectionEnabled?: boolean;
    freshVisitPingDurationSec?: number;
    metroMap?: RegionPatch;
    insetMap?: RegionPatch;
    dismissedPanels?: string[];
    panelOrder?: string[];
    restoreHomePanels?: boolean;
    siteDeploy?: Partial<SiteDeploySetting>;
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
    if (typeof body.skillsSectionEnabled === "boolean") {
      await setSkillsSectionEnabled(body.skillsSectionEnabled);
      revalidatePath("/");
    }
    if (typeof body.freshVisitPingDurationSec === "number") {
      await setFreshVisitPingDurationSec(body.freshVisitPingDurationSec);
    }
    if (body.metroMap === null) {
      await setMetroMapSetting(null);
    } else if (body.metroMap && typeof body.metroMap === "object") {
      await setMetroMapSetting(body.metroMap);
    }
    if (body.insetMap === null) {
      await setInsetMapSetting(null);
    } else if (body.insetMap && typeof body.insetMap === "object") {
      await setInsetMapSetting(body.insetMap);
    }
    if (body.siteDeploy && typeof body.siteDeploy === "object") {
      await setSiteDeploySetting(body.siteDeploy);
      revalidatePath("/");
      revalidatePath("/pipeline");
    }
    if (body.restoreHomePanels) {
      await restorePipelineHomePanels();
    } else {
      if (Array.isArray(body.dismissedPanels)) {
        await setPipelineHomeDismissed(
          body.dismissedPanels.filter((p): p is string => typeof p === "string"),
        );
      }
      if (Array.isArray(body.panelOrder)) {
        await setPipelineHomePanelOrder(
          body.panelOrder.filter((p): p is string => typeof p === "string"),
        );
      }
    }

    const settings = await getPipelineSettingsSnapshot();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("settings patch failed", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
