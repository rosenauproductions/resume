import { desc, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { applications, chatCache, chatMessages, visitorIdentifications, visits } from "./schema";
import { normalizeQuestion } from "@/lib/chat/cache";

export type ChatTurnRow = {
  id: string;
  sessionId: string;
  deviceId: string;
  visitorMessage: string;
  botReply: string;
  fromCache: boolean;
  createdAt: string;
  visitor: {
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    leadCompany: string;
    leadTitle: string;
    freeText: string;
    applicationId: string | null;
  } | null;
  linkedJob: {
    id: string;
    company: string;
    title: string;
    location: string;
  } | null;
  latestVisit: {
    id: string;
    city: string;
    region: string;
    country: string;
    path: string;
    occurredAt: string;
    linkConfidence: string;
  } | null;
};

function iso(d: Date | string | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") return d;
  return d.toISOString();
}

export async function listChatTurns(limit = 200): Promise<ChatTurnRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .orderBy(desc(chatMessages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));

  if (!rows.length) return [];

  const deviceIds = [
    ...new Set(rows.map((r) => (r.deviceId || "").trim()).filter(Boolean)),
  ];

  const idents = deviceIds.length
    ? await db
        .select()
        .from(visitorIdentifications)
        .where(inArray(visitorIdentifications.deviceId, deviceIds))
    : [];
  const identByDevice = new Map(idents.map((i) => [i.deviceId, i]));

  const appIds = [
    ...new Set(idents.map((i) => i.applicationId).filter((id): id is string => Boolean(id))),
  ];
  const apps = appIds.length
    ? await db.select().from(applications).where(inArray(applications.id, appIds))
    : [];
  const appById = new Map(apps.map((a) => [a.id, a]));

  const latestVisitByDevice = new Map<
    string,
    {
      id: string;
      city: string;
      region: string;
      country: string;
      path: string;
      occurredAt: Date;
      linkConfidence: string;
      linkedApplicationId: string | null;
    }
  >();

  if (deviceIds.length) {
    const visitRows = await db
      .select({
        id: visits.id,
        sessionFingerprint: visits.sessionFingerprint,
        city: visits.city,
        region: visits.region,
        country: visits.country,
        path: visits.path,
        occurredAt: visits.occurredAt,
        linkConfidence: visits.linkConfidence,
        linkedApplicationId: visits.linkedApplicationId,
      })
      .from(visits)
      .where(inArray(visits.sessionFingerprint, deviceIds))
      .orderBy(desc(visits.occurredAt))
      .limit(800);

    for (const v of visitRows) {
      const fp = (v.sessionFingerprint || "").trim();
      if (!fp || latestVisitByDevice.has(fp)) continue;
      latestVisitByDevice.set(fp, v);
    }
  }

  const visitAppIds = [
    ...new Set(
      [...latestVisitByDevice.values()]
        .map((v) => v.linkedApplicationId)
        .filter((id): id is string => typeof id === "string" && id.length > 0 && !appById.has(id)),
    ),
  ];
  if (visitAppIds.length) {
    const moreApps = await db
      .select()
      .from(applications)
      .where(inArray(applications.id, visitAppIds));
    for (const a of moreApps) appById.set(a.id, a);
  }

  return rows.map((r) => {
    const deviceId = (r.deviceId || "").trim();
    const ident = deviceId ? identByDevice.get(deviceId) ?? null : null;
    const visit = deviceId ? latestVisitByDevice.get(deviceId) ?? null : null;
    const appId = ident?.applicationId || visit?.linkedApplicationId || null;
    const app = appId ? appById.get(appId) ?? null : null;

    return {
      id: r.id,
      sessionId: r.sessionId,
      deviceId,
      visitorMessage: r.visitorMessage,
      botReply: r.botReply,
      fromCache: Boolean(r.fromCache),
      createdAt: iso(r.createdAt),
      visitor: ident
        ? {
            contactName: ident.contactName || "",
            contactEmail: ident.contactEmail || "",
            contactPhone: ident.contactPhone || "",
            leadCompany: ident.leadCompany || "",
            leadTitle: ident.leadTitle || "",
            freeText: ident.freeText || "",
            applicationId: ident.applicationId,
          }
        : null,
      linkedJob: app
        ? {
            id: app.id,
            company: app.company,
            title: app.title,
            location: app.location,
          }
        : null,
      latestVisit: visit
        ? {
            id: visit.id,
            city: visit.city || "",
            region: visit.region || "",
            country: visit.country || "",
            path: visit.path || "",
            occurredAt: iso(visit.occurredAt),
            linkConfidence: visit.linkConfidence || "",
          }
        : null,
    };
  });
}

export async function insertChatTurn(input: {
  sessionId: string;
  deviceId: string;
  visitorMessage: string;
  botReply: string;
  fromCache?: boolean;
}) {
  const db = getDb();
  const deviceId = (input.deviceId || "").trim().slice(0, 128);
  if (!deviceId) {
    console.warn("chat turn logged without deviceId (unlinked visitor)");
  }
  await db.insert(chatMessages).values({
    sessionId: input.sessionId.slice(0, 128) || "anonymous",
    deviceId,
    visitorMessage: input.visitorMessage.slice(0, 4000),
    botReply: input.botReply.slice(0, 8000),
    fromCache: Boolean(input.fromCache),
  });
}

/** Delete chat turns and matching FAQ cache rows so garbage is not reused. */
export async function deleteChatTurns(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids.map((s) => s.trim()).filter(Boolean))];
  if (!unique.length) return [];
  const db = getDb();

  const rows = await db
    .select({
      id: chatMessages.id,
      visitorMessage: chatMessages.visitorMessage,
    })
    .from(chatMessages)
    .where(inArray(chatMessages.id, unique));

  const norms = [
    ...new Set(
      rows
        .map((r) => normalizeQuestion(r.visitorMessage || ""))
        .filter(Boolean),
    ),
  ];

  if (norms.length) {
    await db.delete(chatCache).where(inArray(chatCache.questionNorm, norms));
  }

  const deleted = await db
    .delete(chatMessages)
    .where(inArray(chatMessages.id, unique))
    .returning({ id: chatMessages.id });
  return deleted.map((r) => r.id);
}
