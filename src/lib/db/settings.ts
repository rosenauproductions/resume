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
import { getDb, dbConfigured } from "./index";
import { siteSettings } from "./schema";

export type { InsetMapSetting, MetroMapSetting };

export const SETTING_VISITOR_IDENTIFY = "visitor_identify_prompt";
export const SETTING_PIPELINE_HOME = "pipeline_home_dismissed";
export const SETTING_SKILLS_SECTION = "skills_section";
export const SETTING_FRESH_VISIT_PING = "fresh_visit_ping";
export const SETTING_METRO_MAP = "metro_map";
export const SETTING_INSET_MAP = "inset_map";
export const SETTING_SITE_DEPLOY = "site_deploy";

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

/**
 * Deploy-facing site config (not Vercel secrets).
 * ntfy token / Discord webhook / DATABASE_URL stay in env.
 * Future: first-run setup wizard can write the same `site_deploy` + feature keys.
 */
export type SiteDeploySetting = {
  /** Open Graph / brand name */
  siteName: string;
  /** Canonical public URL (https://…) */
  publicUrl: string;
  metaTitle: string;
  metaDescription: string;
  /** Overrides VISIT_NOTIFY_NTFY_TOPIC when non-empty */
  ntfyTopic: string;
  /** ntfy base URL, e.g. https://ntfy.sh or self-hosted */
  ntfyServer: string;
};

/** Read-only infra flags for the Settings UI (never expose secret values). */
export type PipelineEnvStatus = {
  database: boolean;
  databaseHost: string | null;
  ntfyTopicEnv: boolean;
  ntfyToken: boolean;
  discord: boolean;
  blob: boolean;
  aiGateway: boolean;
  pipelineSecret: boolean;
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
export const DEFAULT_SITE_DEPLOY: SiteDeploySetting = {
  siteName: "Chris Rosenau",
  publicUrl: "https://resume-rho-taupe.vercel.app",
  metaTitle: "Chris Rosenau — Multimedia Designer & Learning Media Specialist",
  metaDescription:
    "Multimedia design, graphic arts, video, LMS administration, AI development, and programming. Dallas-based learning media specialist.",
  ntfyTopic: "",
  ntfyServer: "https://ntfy.sh",
};

function clampFreshVisitPingSec(n: number): number {
  if (!Number.isFinite(n)) return FRESH_VISIT_PING_DEFAULT_SEC;
  return Math.min(
    FRESH_VISIT_PING_MAX_SEC,
    Math.max(FRESH_VISIT_PING_MIN_SEC, Math.round(n)),
  );
}

export function normalizePublicUrl(raw: unknown, fallback = DEFAULT_SITE_DEPLOY.publicUrl): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return fallback;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    return u.origin;
  } catch {
    return fallback;
  }
}

export function normalizeNtfyServer(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return DEFAULT_SITE_DEPLOY.ntfyServer;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return DEFAULT_SITE_DEPLOY.ntfyServer;
    }
    return u.origin;
  } catch {
    return DEFAULT_SITE_DEPLOY.ntfyServer;
  }
}

export function normalizeSiteDeploySetting(
  raw: Record<string, unknown> | null | undefined,
): SiteDeploySetting {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SITE_DEPLOY };
  return {
    siteName:
      typeof raw.siteName === "string" && raw.siteName.trim()
        ? raw.siteName.trim().slice(0, 120)
        : DEFAULT_SITE_DEPLOY.siteName,
    publicUrl: normalizePublicUrl(raw.publicUrl),
    metaTitle:
      typeof raw.metaTitle === "string" && raw.metaTitle.trim()
        ? raw.metaTitle.trim().slice(0, 200)
        : DEFAULT_SITE_DEPLOY.metaTitle,
    metaDescription:
      typeof raw.metaDescription === "string" && raw.metaDescription.trim()
        ? raw.metaDescription.trim().slice(0, 400)
        : DEFAULT_SITE_DEPLOY.metaDescription,
    ntfyTopic:
      typeof raw.ntfyTopic === "string" ? raw.ntfyTopic.trim().slice(0, 120) : "",
    ntfyServer: normalizeNtfyServer(raw.ntfyServer),
  };
}

function envHostFromDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

export function getPipelineEnvStatus(): PipelineEnvStatus {
  return {
    database: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    databaseHost: envHostFromDatabaseUrl(),
    ntfyTopicEnv: Boolean(process.env.VISIT_NOTIFY_NTFY_TOPIC?.trim()),
    ntfyToken: Boolean(process.env.VISIT_NOTIFY_NTFY_TOKEN?.trim()),
    discord: Boolean(process.env.VISIT_NOTIFY_DISCORD_WEBHOOK?.trim()),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
    aiGateway: Boolean(
      process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim(),
    ),
    pipelineSecret: Boolean(process.env.JOB_TRACKER_SECRET?.trim()),
  };
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

export async function getSiteDeploySetting(): Promise<SiteDeploySetting> {
  const raw = await getSettingJson(SETTING_SITE_DEPLOY);
  return normalizeSiteDeploySetting(raw);
}

export async function setSiteDeploySetting(
  patch: Partial<SiteDeploySetting>,
): Promise<SiteDeploySetting> {
  const current = await getSiteDeploySetting();
  const next = normalizeSiteDeploySetting({
    ...current,
    ...patch,
  } as unknown as Record<string, unknown>);
  await setSettingJson(SETTING_SITE_DEPLOY, next);
  return next;
}

/** Effective ntfy topic: DB override, else env. */
export async function resolveNtfyNotifyConfig(): Promise<{
  topic: string | null;
  server: string;
}> {
  let deploy = { ...DEFAULT_SITE_DEPLOY };
  if (dbConfigured()) {
    try {
      deploy = await getSiteDeploySetting();
    } catch {
      // keep defaults
    }
  }
  const topic =
    deploy.ntfyTopic.trim() || process.env.VISIT_NOTIFY_NTFY_TOPIC?.trim() || null;
  return {
    topic,
    server: deploy.ntfyServer || DEFAULT_SITE_DEPLOY.ntfyServer,
  };
}

/** Public + admin snapshot used by pipeline UI. */
export async function getPipelineSettingsSnapshot() {
  const [visitorIdentify, pipelineHome, skillsSection, freshVisitPing, metroMap, insetMap, siteDeploy] =
    await Promise.all([
      getVisitorIdentifySetting(),
      getPipelineHomeSetting(),
      getSkillsSectionSetting(),
      getFreshVisitPingSetting(),
      getMetroMapSetting(),
      getInsetMapSetting(),
      getSiteDeploySetting(),
    ]);
  return {
    visitorIdentify,
    pipelineHome,
    skillsSection,
    freshVisitPing,
    metroMap,
    insetMap,
    siteDeploy,
    envStatus: getPipelineEnvStatus(),
  };
}
