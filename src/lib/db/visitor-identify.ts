import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./index";
import { createApplication, listOpenApplicationsForAssociation } from "./applications";
import { getVisitorIdentifySetting } from "./settings";
import { visits, visitorIdentifications } from "./schema";
import { linkVisit } from "./visits";
import type { IdentifyPosition, IdentifyPromptPayload } from "@/lib/visit-identify-types";

export type { IdentifyPosition, IdentifyPromptPayload } from "@/lib/visit-identify-types";

export type VisitorLeadInput = {
  name: string;
  email: string;
  phone?: string;
  company: string;
  title?: string;
  location?: string;
  message?: string;
};

function isPublicResumePath(path: string) {
  if (!path || path === "/") return true;
  if (path === "/pipeline" || path.startsWith("/pipeline/")) return false;
  if (path === "/head-count" || path.startsWith("/head-count/")) return false;
  return true;
}

export async function hasVisitorIdentified(deviceId: string): Promise<boolean> {
  const id = (deviceId || "").trim();
  if (!id) return false;
  const db = getDb();
  const rows = await db
    .select({ id: visitorIdentifications.id })
    .from(visitorIdentifications)
    .where(eq(visitorIdentifications.deviceId, id))
    .limit(1);
  return rows.length > 0;
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

/**
 * Build identify-prompt payload after a visit is recorded.
 * Show when: toggle on, public resume path, device not ignored, not yet identified,
 * and this device has prior public visits (repeat visitor).
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

  if (await hasVisitorIdentified(deviceId)) return null;

  // Prior public visits including the one just recorded → repeat when >= 2
  const prior = await countPriorPublicVisits(deviceId);
  if (prior < 2) return null;

  const apps = await listOpenApplicationsForAssociation();
  const positions: IdentifyPosition[] = apps.map((a) => ({
    id: a.id,
    company: a.company,
    title: a.title,
  }));

  let suggested: IdentifyPosition | null = null;
  if (
    input.linkedApplicationId &&
    (input.linkConfidence === "suggested" || input.linkConfidence === "confirmed")
  ) {
    suggested = positions.find((p) => p.id === input.linkedApplicationId) ?? null;
  }

  // Fallback: unique prior confirmed/suggested link for this device
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
    visitId: input.visitId,
    suggested,
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
  const values = {
    applicationId: input.applicationId,
    freeText: input.freeText,
    confirmedSuggested: input.confirmedSuggested,
    contactName: lead?.name?.trim() || "",
    contactEmail: lead?.email?.trim() || "",
    contactPhone: lead?.phone?.trim() || "",
    leadCompany: lead?.company?.trim() || "",
    leadTitle: lead?.title?.trim() || "",
    leadLocation: lead?.location?.trim() || "",
    updatedAt: new Date(),
  };

  const existing = await db
    .select({ id: visitorIdentifications.id })
    .from(visitorIdentifications)
    .where(eq(visitorIdentifications.deviceId, input.deviceId))
    .limit(1);

  if (existing.length) {
    await db
      .update(visitorIdentifications)
      .set(values)
      .where(eq(visitorIdentifications.deviceId, input.deviceId));
  } else {
    await db.insert(visitorIdentifications).values({
      deviceId: input.deviceId,
      ...values,
    });
  }
}

async function createWebsiteLeadApplication(input: {
  deviceId: string;
  freeText: string;
  lead: VisitorLeadInput;
  visitId?: string | null;
}): Promise<string> {
  const company = input.lead.company.trim() || "Website lead";
  const title = input.lead.title?.trim() || "Opportunity (website lead)";
  const location = input.lead.location?.trim() || "";
  const lookingFor = input.freeText || input.lead.message?.trim() || "";
  const noteLines = [
    "Website lead from resume identify prompt",
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
    statusRaw: "website_lead",
    source: "Website lead",
    tags: ["website-lead"],
    description: input.lead.message?.trim() || lookingFor || "",
    notes: noteLines.join("\n"),
    userInterest: "inbound",
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
    if (!lead?.company?.trim()) throw new Error("Company is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())) {
      throw new Error("Enter a valid email");
    }
  }

  if (!applicationId && !freeText && !creatingLead) {
    throw new Error("Pick a position or describe what you are looking for");
  }

  let createdLead = false;
  if (creatingLead && lead) {
    applicationId = await createWebsiteLeadApplication({
      deviceId,
      freeText,
      lead,
      visitId: input.visitId,
    });
    createdLead = true;
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

  return { ok: true, applicationId, createdLead };
}
