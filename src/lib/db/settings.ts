import { eq } from "drizzle-orm";
import {
  DEFAULT_INSET_MAP,
  DEFAULT_METRO_MAP,
  normalizeInsetMapSetting,
  normalizeMetroMapSetting,
  type InsetMapSetting,
  type MetroMapSetting,
} from "@/lib/pipeline/map-regions";
import {
  DEFAULT_HOME_PANEL_ORDER,
  normalizeHomePanelOrder,
} from "@/lib/pipeline/home-panels";
import { getDb } from "./index";
import { siteSettings } from "./schema";

export type { InsetMapSetting, MetroMapSetting };

export const SETTING_VISITOR_IDENTIFY = "visitor_identify_prompt";
export const SETTING_PIPELINE_HOME = "pipeline_home_dismissed";
export const SETTING_SKILLS_SECTION = "skills_section";
export const SETTING_FRESH_VISIT_PING = "fresh_visit_ping";
export const SETTING_METRO_MAP = "metro_map";
export const SETTING_INSET_MAP = "inset_map";

export type VisitorIdentifySetting = {
  enabled: boolean;
};

export type PipelineHomeSetting = {
  dismissedPanels: string[];
  panelOrder: string[];
};

/** When false, Skills & tools is hidden on the public resume. Default: hidden. */
export type SkillsSectionSetting = {
  enabled: boolean;
};

/** How long the large “recent visit” radar burst plays before settling to normal glow. */
export type FreshVisitPingSetting = {
  durationSec: number;
};

export const FRESH_VISIT_PING_MIN_SEC = 1;
export const FRESH_VISIT_PING_MAX_SEC = 30;
export const FRESH_VISIT_PING_DEFAULT_SEC = 4;

const DEFAULT_VISITOR_IDENTIFY: VisitorIdentifySetting = { enabled: false };
const DEFAULT_PIPELINE_HOME: PipelineHomeSetting = {
  dismissedPanels: [],
  panelOrder: [...DEFAULT_HOME_PANEL_ORDER],
};
const DEFAULT_SKILLS_SECTION: SkillsSectionSetting = { enabled: false };
const DEFAULT_FRESH_VISIT_PING: FreshVisitPingSetting = {
  durationSec: FRESH_VISIT_PING_DEFAULT_SEC,
};

function clampFreshVisitPingSec(n: number): number {
  if (!Number.isFinite(n)) return FRESH_VISIT_PING_DEFAULT_SEC;
  return Math.min(
    FRESH_VISIT_PING_MAX_SEC,
    Math.max(FRESH_VISIT_PING_MIN_SEC, Math.round(n)),
  );
}

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
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PIPELINE_HOME, panelOrder: [...DEFAULT_HOME_PANEL_ORDER] };
  const panels = Array.isArray(raw.dismissedPanels)
    ? raw.dismissedPanels.filter((p): p is string => typeof p === "string")
    : [];
  return {
    dismissedPanels: panels,
    panelOrder: normalizeHomePanelOrder(raw.panelOrder),
  };
}

export async function setPipelineHomeSetting(
  patch: Partial<PipelineHomeSetting>,
): Promise<PipelineHomeSetting> {
  const current = await getPipelineHomeSetting();
  const next: PipelineHomeSetting = {
    dismissedPanels:
      patch.dismissedPanels != null
        ? [...new Set(patch.dismissedPanels.filter(Boolean))]
        : current.dismissedPanels,
    panelOrder:
      patch.panelOrder != null
        ? normalizeHomePanelOrder(patch.panelOrder)
        : current.panelOrder,
  };
  await setSettingJson(SETTING_PIPELINE_HOME, next);
  return next;
}

export async function setPipelineHomeDismissed(
  dismissedPanels: string[],
): Promise<PipelineHomeSetting> {
  return setPipelineHomeSetting({ dismissedPanels });
}

export async function setPipelineHomePanelOrder(
  panelOrder: string[],
): Promise<PipelineHomeSetting> {
  return setPipelineHomeSetting({ panelOrder });
}

export async function dismissPipelineHomePanel(panelId: string): Promise<PipelineHomeSetting> {
  const current = await getPipelineHomeSetting();
  if (current.dismissedPanels.includes(panelId)) return current;
  return setPipelineHomeSetting({
    dismissedPanels: [...current.dismissedPanels, panelId],
  });
}

export async function restorePipelineHomePanels(): Promise<PipelineHomeSetting> {
  return setPipelineHomeSetting({
    dismissedPanels: [],
    panelOrder: [...DEFAULT_HOME_PANEL_ORDER],
  });
}

export async function getSkillsSectionSetting(): Promise<SkillsSectionSetting> {
  const raw = await getSettingJson(SETTING_SKILLS_SECTION);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SKILLS_SECTION };
  return { enabled: Boolean(raw.enabled) };
}

export async function setSkillsSectionEnabled(enabled: boolean): Promise<SkillsSectionSetting> {
  const next = { enabled: Boolean(enabled) };
  await setSettingJson(SETTING_SKILLS_SECTION, next);
  return next;
}

export async function getFreshVisitPingSetting(): Promise<FreshVisitPingSetting> {
  const raw = await getSettingJson(SETTING_FRESH_VISIT_PING);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FRESH_VISIT_PING };
  return {
    durationSec: clampFreshVisitPingSec(Number(raw.durationSec)),
  };
}

export async function setFreshVisitPingDurationSec(
  durationSec: number,
): Promise<FreshVisitPingSetting> {
  const next = { durationSec: clampFreshVisitPingSec(durationSec) };
  await setSettingJson(SETTING_FRESH_VISIT_PING, next);
  return next;
}

export async function getMetroMapSetting(): Promise<MetroMapSetting> {
  const raw = await getSettingJson(SETTING_METRO_MAP);
  return normalizeMetroMapSetting(raw);
}

export async function setMetroMapSetting(
  input: Partial<MetroMapSetting> | null,
): Promise<MetroMapSetting> {
  const next = normalizeMetroMapSetting(
    input == null ? { ...DEFAULT_METRO_MAP } : { ...(await getMetroMapSetting()), ...input },
  );
  await setSettingJson(SETTING_METRO_MAP, next);
  return next;
}

export async function getInsetMapSetting(): Promise<InsetMapSetting> {
  const raw = await getSettingJson(SETTING_INSET_MAP);
  return normalizeInsetMapSetting(raw);
}

export async function setInsetMapSetting(
  input: Partial<InsetMapSetting> | null,
): Promise<InsetMapSetting> {
  const next = normalizeInsetMapSetting(
    input == null ? { ...DEFAULT_INSET_MAP } : { ...(await getInsetMapSetting()), ...input },
  );
  await setSettingJson(SETTING_INSET_MAP, next);
  return next;
}

/** Public + admin snapshot used by pipeline UI. */
export async function getPipelineSettingsSnapshot() {
  const [visitorIdentify, pipelineHome, skillsSection, freshVisitPing, metroMap, insetMap] =
    await Promise.all([
      getVisitorIdentifySetting(),
      getPipelineHomeSetting(),
      getSkillsSectionSetting(),
      getFreshVisitPingSetting(),
      getMetroMapSetting(),
      getInsetMapSetting(),
    ]);
  return {
    visitorIdentify,
    pipelineHome,
    skillsSection,
    freshVisitPing,
    metroMap,
    insetMap,
  };
}
