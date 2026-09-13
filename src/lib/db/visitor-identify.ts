import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  createApplication,
  getApplication,
  listOpenApplicationsForAssociation,
} from "./applications";
import { getVisitorIdentifySetting } from "./settings";
import { visits, visitorIdentifications } from "./schema";
import { getVisit, isDeviceIgnored, linkVisit } from "./visits";
import { extractCityKey } from "@/lib/pipeline/geo-cities";
import { notifyVisitChannels } from "@/lib/visit-notify";
import type {
  IdentifyKnownIdentity,
  IdentifyPosition,
  IdentifyPromptPayload,
} from "@/lib/visit-identify-types";

export type { IdentifyPosition, IdentifyPromptPayload, IdentifyKnownIdentity } from "@/lib/visit-identify-types";

export type VisitorLeadInput = {
  name: string;
  email: string;
  phone?: string;
  company: string;
  title?: string;
  location?: string;
  message?: string;
  /** Visitor explicitly asks Chris to follow up. */
  requestContact?: boolean;
};

function isPublicResumePath(path: string) {
  const base = (path || "").split("?")[0] || "/";
  if (!base || base === "/") return true;
  if (base === "/pipeline" || base.startsWith("/pipeline/")) return false;
  if (base === "/head-count" || base.startsWith("/head-count/")) return false;
  return false;
}

export async function hasVisitorIdentified(deviceId: string): Promise<boolean> {
  const id = (deviceId || "").trim();
  if (!id) return false;
  return Boolean(await getVisitorIdentification(id));
}

export async function getVisitorIdentification(deviceId: string) {
  const id = (deviceId || "").trim();
  if (!id) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(visitorIdentifications)
    .where(eq(visitorIdentifications.deviceId, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function countPriorPublicVisits(deviceId: string): Promise<number> {
  const id = (deviceId || "").trim();
  if (!id) return 0;
  const db = getDb();
  const rows = await db
    .select({ n: count() })
    .from(visits)
    .where(
      and(
        eq(visits.sessionFingerprint, id),
        ne(visits.path, "/pipeline"),
        sql`${visits.path} not like '/pipeline/%'`,
        sql`${visits.path} not like '/head-count%'`,
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

function knownIdentityFromRow(
  row: {
    applicationId: string | null;
    freeText: string;
    contactName: string;
    leadCompany: string;
    leadTitle: string;
  },
  positions: IdentifyPosition[],
): IdentifyKnownIdentity {
  const matched = row.applicationId
    ? positions.find((p) => p.id === row.applicationId) ?? null
    : null;
  const company = matched?.company || row.leadCompany || "";
  const title = matched?.title || row.leadTitle || "";
  const contactName = (row.contactName || "").trim();
  const freeText = (row.freeText || "").trim();

  let label = "";
  // Prefer role/title for the soft “viewing as …” line
  if (title) label = title;
  else if (company) label = company;
  else if (contactName) label = contactName;
  else if (freeText) label = freeText.length > 72 ? `${freeText.slice(0, 71)}…` : freeText;
  else label = "a guest";

  return {
    applicationId: row.applicationId,
    company,
    title,
    freeText,
    contactName,
    label,
  };
}

/**
 * Build identify / welcome prompt after a visit is recorded.
 * Identity is determined from the DB row for this device fingerprint — no cookies.
 * - First-time repeat visitor → identify
 * - Already identified in DB → soft welcome + option to correct
 */
export async function buildIdentifyPrompt(input: {
  path: string;
  deviceId: string;
  visitId: string | null;
  linkedApplicationId: string | null;
  linkConfidence: string | null;
  deviceIgnored: boolean;
}): Promise<IdentifyPromptPayload | null> {
  if (input.deviceIgnored) return null;
  if (!isPublicResumePath(input.path)) return null;
  const deviceId = (input.deviceId || "").trim();
  if (!deviceId) return null;

  const setting = await getVisitorIdentifySetting();
  if (!setting.enabled) return null;

  const apps = await listOpenApplicationsForAssociation();
  const positions: IdentifyPosition[] = apps.map((a) => ({
    id: a.id,
    company: a.company,
    title: a.title,
  }));

  const existing = await getVisitorIdentification(deviceId);

  if (existing) {
    const known = knownIdentityFromRow(existing, positions);

    return {
      show: true,
      mode: "welcome",
      visitId: input.visitId,
      suggested: known.applicationId
        ? positions.find((p) => p.id === known.applicationId) ?? null
        : null,
      known,
      positions,
    };
  }

  const prior = await countPriorPublicVisits(deviceId);
  if (prior < 2) return null;

  let suggested: IdentifyPosition | null = null;
  if (
    input.linkedApplicationId &&
    (input.linkConfidence === "suggested" || input.linkConfidence === "confirmed")
  ) {
    suggested = positions.find((p) => p.id === input.linkedApplicationId) ?? null;
  }

  if (!suggested) {
    const db = getDb();
    const priorLinks = await db
      .select({
        linkedApplicationId: visits.linkedApplicationId,
        linkConfidence: visits.linkConfidence,
      })
      .from(visits)
      .where(
        and(
          eq(visits.sessionFingerprint, deviceId),
          sql`${visits.linkedApplicationId} is not null`,
          sql`${visits.linkConfidence} in ('suggested', 'confirmed')`,
        ),
      )
      .orderBy(desc(visits.occurredAt))
      .limit(8);

    const ids = [
      ...new Set(
        priorLinks
          .map((r) => r.linkedApplicationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (ids.length === 1) {
      suggested = positions.find((p) => p.id === ids[0]) ?? null;
    }
  }

  return {
    show: true,
    mode: "identify",
    visitId: input.visitId,
    suggested,
    known: null,
    positions,
  };
}

async function upsertIdentificationRow(input: {
  deviceId: string;
  applicationId: string | null;
  freeText: string;
  confirmedSuggested: boolean;
  lead?: VisitorLeadInput | null;
}) {
  const db = getDb();
  const lead = input.lead;
  const base = {
    applicationId: input.applicationId,
    freeText: input.freeText,
    confirmedSuggested: input.confirmedSuggested,
    updatedAt: new Date(),
  };
  const leadFields = lead
    ? {
        contactName: lead.name?.trim() || "",
        contactEmail: lead.email?.trim() || "",
        contactPhone: lead.phone?.trim() || "",
        leadCompany: lead.company?.trim() || "",
        leadTitle: lead.title?.trim() || "",
        leadLocation: lead.location?.trim() || "",
      }
    : null;

  const existing = await db
    .select({ id: visitorIdentifications.id })
    .from(visitorIdentifications)
    .where(eq(visitorIdentifications.deviceId, input.deviceId))
    .limit(1);

  if (existing.length) {
    await db
      .update(visitorIdentifications)
      .set(leadFields ? { ...base, ...leadFields } : base)
      .where(eq(visitorIdentifications.deviceId, input.deviceId));
  } else {
    await db.insert(visitorIdentifications).values({
      deviceId: input.deviceId,
      ...base,
      contactName: leadFields?.contactName || "",
      contactEmail: leadFields?.contactEmail || "",
      contactPhone: leadFields?.contactPhone || "",
      leadCompany: leadFields?.leadCompany || "",
      leadTitle: leadFields?.leadTitle || "",
      leadLocation: leadFields?.leadLocation || "",
    });
  }
}

/** Prefer an existing open pipeline job when company (and optional title) match. */
export async function findOpenApplicationForLead(input: {
  company?: string | null;
  title?: string | null;
}): Promise<{ id: string; company: string; title: string } | null> {
  const company = (input.company || "").trim().toLowerCase();
  if (!company || company === "contact request" || company === "website lead") {
    return null;
  }
  const title = (input.title || "").trim().toLowerCase();
  const apps = await listOpenApplicationsForAssociation();
  if (!apps.length) return null;

  const scored = apps
    .map((a) => {
      const c = a.company.trim().toLowerCase();
      const t = a.title.trim().toLowerCase();
      let score = 0;
      if (c === company) score += 4;
      else if (c.includes(company) || company.includes(c)) score += 2;
      if (title) {
        if (t === title) score += 3;
        else if (t.includes(title) || title.includes(t)) score += 1;
      }
      return { a, score };
    })
    .filter((x) => x.score >= 2)
    .sort((x, y) => y.score - x.score);

  const best = scored[0]?.a;
  return best ? { id: best.id, company: best.company, title: best.title } : null;
}

async function createWebsiteLeadApplication(input: {
  deviceId: string;
  freeText: string;
  lead: VisitorLeadInput;
  visitId?: string | null;
}): Promise<string> {
  const wantsContact = Boolean(input.lead.requestContact);
  const company =
    input.lead.company.trim() || (wantsContact ? "Contact request" : "Website lead");
  const title = input.lead.title?.trim() || (wantsContact ? "Please contact me" : "Opportunity (website lead)");
  const location = input.lead.location?.trim() || "";
  const lookingFor = input.freeText || input.lead.message?.trim() || "";
  const noteLines = [
    wantsContact
      ? "Website contact request from resume"
      : "Website lead from resume identify prompt",
    wantsContact ? "Requested contact: yes" : null,
    `Name: ${input.lead.name.trim()}`,
    `Email: ${input.lead.email.trim()}`,
    input.lead.phone?.trim() ? `Phone: ${input.lead.phone.trim()}` : null,
    lookingFor ? `Looking for: ${lookingFor}` : null,
    `Device: ${input.deviceId}`,
  ].filter(Boolean);

  const job = await createApplication({
    company,
    title,
    shortName: company.slice(0, 24),
    location,
    status: "researching",
    statusRaw: wantsContact ? "contact_request" : "website_lead",
    source: wantsContact ? "Contact request" : "Website lead",
    tags: wantsContact ? ["website-lead", "contact-requested"] : ["website-lead"],
    description: input.lead.message?.trim() || lookingFor || "",
    notes: noteLines.join("\n"),
    userInterest: wantsContact ? "contact-requested" : "inbound",
    datePrecision: "unknown",
  });

  if (input.visitId) {
    try {
      await linkVisit(input.visitId, "link", job.id);
    } catch (error) {
      console.error("website lead visit link failed", error);
    }
  }

  return job.id;
}

/**
 * Identify/lead prompt for chat — always available (unlike scroll welcome).
 * `needsLink` is true when this visit/device is not already tied to a pipeline job.
 */
export async function buildChatIdentifyContext(input: {
  deviceId: string;
  visitId?: string | null;
}): Promise<{
  prompt: IdentifyPromptPayload;
  needsLink: boolean;
  suggestedLabel: string | null;
}> {
  const deviceId = (input.deviceId || "").trim();
  const visitId = (input.visitId || "").trim() || null;

  const apps = await listOpenApplicationsForAssociation();
  const positions: IdentifyPosition[] = apps.map((a) => ({
    id: a.id,
    company: a.company,
    title: a.title,
  }));

  const existing = await getVisitorIdentification(deviceId);
  const visit = visitId ? await getVisit(visitId) : null;

  let suggested: IdentifyPosition | null = null;
  if (
    visit?.linkedApplicationId &&
    (visit.linkConfidence === "suggested" || visit.linkConfidence === "confirmed")
  ) {
    suggested = positions.find((p) => p.id === visit.linkedApplicationId) ?? null;
  }
  if (!suggested && existing?.applicationId) {
    suggested = positions.find((p) => p.id === existing.applicationId) ?? null;
  }

  const known = existing ? knownIdentityFromRow(existing, positions) : null;
  const visitConfirmed =
    Boolean(visit?.linkedApplicationId) && visit?.linkConfidence === "confirmed";
  const hasJobIdentity = Boolean(existing?.applicationId);
  const needsLink = !visitConfirmed && !hasJobIdentity;

  const prompt: IdentifyPromptPayload = {
    show: true,
    mode: existing ? "welcome" : "identify",
    visitId,
    suggested,
    known,
    positions,
  };

  const suggestedLabel = suggested
    ? `${suggested.company} — ${suggested.title}`
    : null;

  return { prompt, needsLink, suggestedLabel };
}

function locationLabel(city: string, region: string, country: string) {
  return [city, region, country].filter(Boolean).join(", ") || "Unknown location";
}

async function notifyIdentificationOutcome(input: {
  deviceId: string;
  applicationId: string | null;
  freeText: string;
  confirmedSuggested: boolean;
  createdLead: boolean;
  visitId?: string | null;
  lead?: VisitorLeadInput | null;
  corrected?: boolean;
}) {
  if (await isDeviceIgnored(input.deviceId)) return;

  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });

  let visitCity = "";
  let visitRegion = "";
  let visitCountry = "";
  if (input.visitId) {
    try {
      const visit = await getVisit(input.visitId);
      if (visit) {
        visitCity = visit.city;
        visitRegion = visit.region;
        visitCountry = visit.country;
      }
    } catch (error) {
      console.error("identify notify visit lookup failed", error);
    }
  }

  const visitLocation = locationLabel(visitCity, visitRegion, visitCountry);
  const knownVisitCity = visitCity ? Boolean(extractCityKey(visitCity)) : false;
  const leadLocation = input.lead?.location?.trim() || "";
  const knownLeadCity = leadLocation ? Boolean(extractCityKey(leadLocation)) : false;
  const freeTextCity = input.freeText ? extractCityKey(input.freeText) : null;

  const baseLines = [
    `**When:** ${when} (Central)`,
    `**Visit geo:** ${visitLocation}`,
    visitCity && !knownVisitCity
      ? `**Geo city not in map DB:** ${visitCity}`
      : null,
    `**Device:** ${input.deviceId.slice(0, 12)}…`,
  ].filter(Boolean) as string[];

  if (input.createdLead && input.lead) {
    const job = input.applicationId ? await getApplication(input.applicationId) : null;
    const wantsContact = Boolean(input.lead.requestContact);
    const lines = [
      ...baseLines,
      wantsContact ? "**Requested contact:** yes" : null,
      `**Name:** ${input.lead.name.trim()}`,
      `**Email:** ${input.lead.email.trim()}`,
      input.lead.phone?.trim() ? `**Phone:** ${input.lead.phone.trim()}` : null,
      `**Company:** ${input.lead.company.trim() || (wantsContact ? "Contact request" : "—")}`,
      input.lead.title?.trim() ? `**Role:** ${input.lead.title.trim()}` : null,
      leadLocation
        ? `**Their location:** ${leadLocation}${knownLeadCity ? "" : " (not in map DB)"}`
        : null,
      input.freeText || input.lead.message?.trim()
        ? `**Note:** ${input.freeText || input.lead.message?.trim()}`
        : null,
      job ? `**Pipeline job:** ${job.company} — ${job.title}` : null,
      wantsContact ? "**Source:** Contact request" : "**Source:** Website lead",
    ].filter(Boolean) as string[];

    await notifyVisitChannels({
      title: wantsContact ? "Contact requested" : "Website lead created",
      lines,
      kind: "lead",
      priority: "high",
    });
    return;
  }

  // Chat/identify left contact but matched an existing open application (no duplicate job)
  if (input.lead && input.applicationId) {
    const job = await getApplication(input.applicationId);
    const wantsContact = Boolean(input.lead.requestContact);
    const lines = [
      ...baseLines,
      wantsContact ? "**Requested contact:** yes" : null,
      `**Name:** ${input.lead.name.trim()}`,
      `**Email:** ${input.lead.email.trim()}`,
      input.lead.phone?.trim() ? `**Phone:** ${input.lead.phone.trim()}` : null,
      `**Company:** ${input.lead.company.trim() || "—"}`,
      input.lead.title?.trim() ? `**Role:** ${input.lead.title.trim()}` : null,
      input.freeText || input.lead.message?.trim()
        ? `**Note:** ${input.freeText || input.lead.message?.trim()}`
        : null,
      job
        ? `**Linked existing job:** ${job.company} — ${job.title}`
        : `**Linked job id:** ${input.applicationId}`,
    ].filter(Boolean) as string[];

    await notifyVisitChannels({
      title: "Visitor linked to existing job",
      lines,
      kind: "lead",
      priority: "high",
    });
    return;
  }

  if (input.applicationId) {
    const job = await getApplication(input.applicationId);
    const lines = [
      ...baseLines,
      job
        ? `**Matched:** ${job.company} — ${job.title}`
        : `**Matched job id:** ${input.applicationId}`,
      input.confirmedSuggested ? "**How:** Confirmed suggested match" : "**How:** Selected from list",
      input.freeText ? `**Note:** ${input.freeText}` : null,
    ].filter(Boolean) as string[];

    await notifyVisitChannels({
      title: input.corrected ? "Visitor corrected job match" : "Visitor matched a job",
      lines,
      kind: "identify",
      priority: "high",
    });
    return;
  }

  // Soft note / no tracked match — call out unknown cities
  const lines = [
    ...baseLines,
    input.freeText ? `**They wrote:** ${input.freeText}` : null,
    freeTextCity
      ? `**City mentioned (known):** ${freeTextCity}`
      : input.freeText
        ? "**No known city found in their note**"
        : null,
    visitCity && !knownVisitCity
      ? "**Action:** Visit geo city is not in the map/alias DB — worth a look"
      : input.corrected
        ? "**Action:** Corrected identity (no pipeline match)"
        : "**Action:** Soft identify with no pipeline match",
  ].filter(Boolean) as string[];

  await notifyVisitChannels({
    title: input.corrected
      ? "Visitor corrected identity"
      : visitCity && !knownVisitCity
        ? "Visitor note — unknown city"
        : "Visitor note — no job match",
    lines,
    kind: "identify",
  });
}

export async function saveVisitorIdentification(input: {
  deviceId: string;
  applicationId?: string | null;
  freeText?: string;
  confirmedSuggested?: boolean;
  visitId?: string | null;
  lead?: VisitorLeadInput | null;
}): Promise<{ ok: true; applicationId: string | null; createdLead: boolean }> {
  const deviceId = (input.deviceId || "").trim();
  if (!deviceId) throw new Error("deviceId required");

  let applicationId = (input.applicationId || "").trim() || null;
  const freeText = (input.freeText || "").trim();
  const lead = input.lead ?? null;
  const creatingLead = Boolean(lead);

  if (creatingLead) {
    if (!lead?.name?.trim()) throw new Error("Name is required");
    if (!lead?.email?.trim()) throw new Error("Email is required");
    if (!lead.requestContact && !lead?.company?.trim()) {
      throw new Error("Company is required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())) {
      throw new Error("Enter a valid email");
    }
  }

  if (!applicationId && !freeText && !creatingLead) {
    throw new Error("Pick a position or describe what you are looking for");
  }

  const alreadyIdentified = await hasVisitorIdentified(deviceId);

  let createdLead = false;
  if (creatingLead && lead) {
    const existingJob = await findOpenApplicationForLead({
      company: lead.company,
      title: lead.title,
    });
    if (existingJob) {
      applicationId = existingJob.id;
      // Attach lead contact to identification + link visit; do not create a duplicate job
      if (input.visitId) {
        try {
          await linkVisit(input.visitId, "link", existingJob.id);
        } catch (error) {
          console.error("lead→existing job visit link failed", error);
        }
      }
    } else {
      applicationId = await createWebsiteLeadApplication({
        deviceId,
        freeText,
        lead,
        visitId: input.visitId,
      });
      createdLead = true;
    }
  }

  await upsertIdentificationRow({
    deviceId,
    applicationId,
    freeText,
    confirmedSuggested: Boolean(input.confirmedSuggested),
    lead,
  });

  // Link visit when choosing an existing tracked position (not already linked above)
  if (!createdLead && input.visitId && applicationId) {
    try {
      await linkVisit(input.visitId, "link", applicationId);
    } catch (error) {
      console.error("identify visit link failed", error);
    }
  }

  try {
    await notifyIdentificationOutcome({
      deviceId,
      applicationId,
      freeText,
      confirmedSuggested: Boolean(input.confirmedSuggested),
      createdLead,
      visitId: input.visitId,
      lead,
      corrected: alreadyIdentified && !createdLead,
    });
  } catch (error) {
    console.error("identify notify failed", error);
  }

  return { ok: true, applicationId, createdLead };
}
