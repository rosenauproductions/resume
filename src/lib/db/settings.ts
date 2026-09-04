import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { siteSettings } from "./schema";

export const SETTING_VISITOR_IDENTIFY = "visitor_identify_prompt";
export const SETTING_PIPELINE_HOME = "pipeline_home_dismissed";

export type VisitorIdentifySetting = {
  enabled: boolean;
};

export type PipelineHomeSetting = {
  dismissedPanels: string[];
};

const DEFAULT_VISITOR_IDENTIFY: VisitorIdentifySetting = { enabled: false };
const DEFAULT_PIPELINE_HOME: PipelineHomeSetting = { dismissedPanels: [] };

async function getSettingJson(key: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const rows = await db
    .select({ valueJson: siteSettings.valueJson })
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1);
  return rows[0]?.valueJson ?? null;
}

async function setSettingJson(key: string, value: Record<string, unknown>) {
  const db = getDb();
  await db
    .insert(siteSettings)
    .values({
      key,
      valueJson: value,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        valueJson: value,
        updatedAt: new Date(),
      },
    });
}

export async function getVisitorIdentifySetting(): Promise<VisitorIdentifySetting> {
  const raw = await getSettingJson(SETTING_VISITOR_IDENTIFY);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_VISITOR_IDENTIFY };
  return { enabled: Boolean(raw.enabled) };
}

export async function setVisitorIdentifyEnabled(enabled: boolean): Promise<VisitorIdentifySetting> {
  const next = { enabled: Boolean(enabled) };
  await setSettingJson(SETTING_VISITOR_IDENTIFY, next);
  return next;
}

export async function getPipelineHomeSetting(): Promise<PipelineHomeSetting> {
  const raw = await getSettingJson(SETTING_PIPELINE_HOME);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PIPELINE_HOME };
  const panels = Array.isArray(raw.dismissedPanels)
    ? raw.dismissedPanels.filter((p): p is string => typeof p === "string")
    : [];
  return { dismissedPanels: panels };
}

export async function setPipelineHomeDismissed(
  dismissedPanels: string[],
): Promise<PipelineHomeSetting> {
  const next = {
    dismissedPanels: [...new Set(dismissedPanels.filter(Boolean))],
  };
  await setSettingJson(SETTING_PIPELINE_HOME, next);
  return next;
}

export async function dismissPipelineHomePanel(panelId: string): Promise<PipelineHomeSetting> {
  const current = await getPipelineHomeSetting();
  if (current.dismissedPanels.includes(panelId)) return current;
  return setPipelineHomeDismissed([...current.dismissedPanels, panelId]);
}

export async function restorePipelineHomePanels(): Promise<PipelineHomeSetting> {
  return setPipelineHomeDismissed([]);
}

/** Public + admin snapshot used by pipeline UI. */
export async function getPipelineSettingsSnapshot() {
  const [visitorIdentify, pipelineHome] = await Promise.all([
    getVisitorIdentifySetting(),
    getPipelineHomeSetting(),
  ]);
  return { visitorIdentify, pipelineHome };
}
