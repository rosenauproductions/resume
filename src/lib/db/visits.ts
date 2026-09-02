import { desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { ignoredDevices, visits, type VisitRow } from "./schema";
import { appendApplicationNote, listOpenApplicationsForAssociation } from "./applications";

/** Comma-separated stable device ids from VISIT_IGNORE_DEVICE_IDS (env still works alongside DB). */
function parseEnvIgnoreDeviceIds(): Set<string> {
  const raw = process.env.VISIT_IGNORE_DEVICE_IDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** True if device id is in env VISIT_IGNORE_DEVICE_IDS or ignored_devices table. */
export async function isDeviceIgnored(deviceId: string): Promise<boolean> {
  const id = (deviceId || "").trim();
  if (!id) return false;
  if (parseEnvIgnoreDeviceIds().has(id)) return true;

  const db = getDb();
  const rows = await db
    .select({ id: ignoredDevices.id })
    .from(ignoredDevices)
    .where(eq(ignoredDevices.deviceId, id))
    .limit(1);
  return rows.length > 0;
}

/** Add a device fingerprint to the DB ignore list (idempotent). */
export async function addIgnoredDevice(
  deviceId: string,
  note = "",
): Promise<{ deviceId: string; created: boolean }> {
  const id = (deviceId || "").trim();
  if (!id) throw new Error("deviceId required");

  const db = getDb();
  const existing = await db
    .select({ id: ignoredDevices.id })
    .from(ignoredDevices)
    .where(eq(ignoredDevices.deviceId, id))
    .limit(1);
  if (existing.length) {
    return { deviceId: id, created: false };
  }

  await db.insert(ignoredDevices).values({
    deviceId: id,
    note: note || "",
  });
  return { deviceId: id, created: true };
}

/** Permanently delete a visit row. */
export async function deleteVisit(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db.delete(visits).where(eq(visits.id, id)).returning({ id: visits.id });
  return deleted.length > 0;
}

export type LinkConfidence = "none" | "suggested" | "confirmed" | "ignored";

export type VisitRecord = {
  id: string;
  occurredAt: string;
  path: string;
  city: string;
  region: string;
  country: string;
  device: string;
  referrer: string;
  timezone: string;
  language: string;
  screen: string;
  sessionFingerprint: string;
  linkedApplicationId: string | null;
  linkConfidence: LinkConfidence;
  linkReason: string;
  locationLabel: string;
};

/** Cities that usually mean you (home / nearby) — skip auto-association. */
const HOME_CITIES = new Set(
  ["sachse", "wylie", "garland", "rowlett", "murphy", "plano"].map((c) => c.toLowerCase()),
);
// Note: Plano is also a job hub — we only treat home cities as ignore when path is /pipeline
// Actually plan says Sachse/Wylie as home. Keep Plano as associable for employers.
HOME_CITIES.delete("plano");

/** Curated city → company aliases for unique strong matches. */
const CITY_COMPANY_ALIASES: Record<string, string[]> = {
  plano: ["capital title", "jpmorgan", "jp morgan", "equinix"],
  mckinney: ["srs", "srs distribution"],
  coppell: ["aaa", "american automobile"],
  livermore: ["lawrence livermore", "llnl"],
  atherton: ["sacred heart"],
  bedford: ["propricer"],
  houston: ["baylor"],
  dallas: ["hallmark"],
  richardson: ["associa", "chewy"],
  austin: ["ryder"],
  "dallas-fort worth": ["american airlines"],
  dfw: ["american airlines"],
};

function normalizeCity(raw: string) {
  try {
    return decodeURIComponent(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\+/g, " ");
  } catch {
    return (raw || "").trim().toLowerCase();
  }
}

function locationLabel(city: string, region: string, country: string) {
  return [city, region, country].filter(Boolean).join(", ") || "Unknown location";
}

function rowToVisit(row: VisitRow): VisitRecord {
  const confidence = row.linkConfidence as LinkConfidence;
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    path: row.path,
    city: row.city,
    region: row.region,
    country: row.country,
    device: row.device,
    referrer: row.referrer,
    timezone: row.timezone,
    language: row.language,
    screen: row.screen,
    sessionFingerprint: row.sessionFingerprint,
    linkedApplicationId: row.linkedApplicationId,
    linkConfidence:
      confidence === "suggested" ||
      confidence === "confirmed" ||
      confidence === "ignored" ||
      confidence === "none"
        ? confidence
        : "none",
    linkReason: row.linkReason,
    locationLabel: locationLabel(row.city, row.region, row.country),
  };
}

export type NewVisitInput = {
  path: string;
  city: string;
  region: string;
  country: string;
  device: string;
  referrer: string;
  timezone: string;
  language: string;
  screen: string;
  sessionFingerprint: string;
  /** When true: store visit as ignored (no job association). Caller skips ntfy. */
  deviceIgnored?: boolean;
};

export async function suggestAssociation(input: {
  path: string;
  city: string;
}): Promise<{ applicationId: string | null; reason: string; confidence: LinkConfidence }> {
  const path = input.path || "/";
  if (path === "/pipeline" || path.startsWith("/pipeline/")) {
    return { applicationId: null, reason: "pipeline self-visit", confidence: "none" };
  }

  const city = normalizeCity(input.city);
  if (!city || city === "unknown") {
    return { applicationId: null, reason: "", confidence: "none" };
  }
  if (HOME_CITIES.has(city)) {
    return { applicationId: null, reason: `home city ignored: ${city}`, confidence: "none" };
  }

  const apps = await listOpenApplicationsForAssociation();
  const aliases = CITY_COMPANY_ALIASES[city] ?? [];
  const scored = apps
    .map((app) => {
      const hay = `${app.company} ${app.location}`.toLowerCase();
      let score = 0;
      let reason = "";
      if (aliases.some((a) => hay.includes(a))) {
        score += 10;
        reason = `city alias match: ${city} → ${app.company}`;
      }
      if (app.location && normalizeCity(app.location).includes(city)) {
        score += 6;
        reason = reason || `location contains city: ${city} → ${app.company}`;
      }
      if (hay.includes(city)) {
        score += 4;
        reason = reason || `company/location text contains ${city}`;
      }
      return { app, score, reason };
    })
    .filter((x) => x.score >= 6)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1) {
    return {
      applicationId: scored[0].app.id,
      reason: scored[0].reason,
      confidence: "suggested",
    };
  }
  if (scored.length > 1 && scored[0].score >= scored[1].score + 4) {
    return {
      applicationId: scored[0].app.id,
      reason: scored[0].reason,
      confidence: "suggested",
    };
  }
  return { applicationId: null, reason: scored.length ? "ambiguous city matches" : "", confidence: "none" };
}

function visitNoteLine(visit: VisitRecord) {
  const when = new Date(visit.occurredAt).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `Resume view ${when} CT · ${visit.locationLabel}${
    visit.linkConfidence === "suggested" ? " (suggested)" : ""
  }`;
}

export async function recordVisit(input: NewVisitInput): Promise<VisitRecord> {
  const suggestion = input.deviceIgnored
    ? {
        applicationId: null as string | null,
        reason: "device ignore list",
        confidence: "ignored" as LinkConfidence,
      }
    : await suggestAssociation({ path: input.path, city: input.city });

  const db = getDb();
  const inserted = await db
    .insert(visits)
    .values({
      path: input.path || "/",
      city: decodeSafe(input.city),
      region: input.region || "",
      country: input.country || "",
      device: input.device || "",
      referrer: input.referrer || "",
      timezone: input.timezone || "",
      language: input.language || "",
      screen: input.screen || "",
      sessionFingerprint: input.sessionFingerprint || "",
      linkedApplicationId: suggestion.applicationId,
      linkConfidence: suggestion.confidence,
      linkReason: suggestion.reason,
    })
    .returning();

  const visit = rowToVisit(inserted[0]);
  if (visit.linkedApplicationId && visit.linkConfidence === "suggested") {
    await appendApplicationNote(visit.linkedApplicationId, visitNoteLine(visit));
  }
  return visit;
}

function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

export async function listVisits(limit = 100): Promise<VisitRecord[]> {
  const db = getDb();
  const rows = await db.select().from(visits).orderBy(desc(visits.occurredAt)).limit(limit);
  return rows.map(rowToVisit);
}

export async function getVisit(id: string): Promise<VisitRecord | null> {
  const db = getDb();
  const rows = await db.select().from(visits).where(eq(visits.id, id)).limit(1);
  return rows[0] ? rowToVisit(rows[0]) : null;
}

export async function linkVisit(
  visitId: string,
  action: "confirm" | "ignore" | "link",
  applicationId?: string,
): Promise<VisitRecord | null> {
  const visit = await getVisit(visitId);
  if (!visit) return null;

  let linkedApplicationId = visit.linkedApplicationId;
  let linkConfidence: LinkConfidence = visit.linkConfidence;
  let linkReason = visit.linkReason;

  if (action === "ignore") {
    linkConfidence = "ignored";
    linkedApplicationId = null;
    linkReason = linkReason || "ignored by user";
  } else if (action === "confirm") {
    if (!linkedApplicationId) return visit;
    linkConfidence = "confirmed";
  } else if (action === "link") {
    if (!applicationId) throw new Error("applicationId required for link");
    linkedApplicationId = applicationId;
    linkConfidence = "confirmed";
    linkReason = linkReason || "manual link";
  }

  const db = getDb();
  const updated = await db
    .update(visits)
    .set({
      linkedApplicationId,
      linkConfidence,
      linkReason,
    })
    .where(eq(visits.id, visitId))
    .returning();

  const next = updated[0] ? rowToVisit(updated[0]) : null;
  if (next && next.linkedApplicationId && (action === "confirm" || action === "link")) {
    await appendApplicationNote(
      next.linkedApplicationId,
      visitNoteLine({ ...next, linkConfidence: "confirmed" }).replace(" (suggested)", " (confirmed)"),
    );
  }
  return next;
}
