import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { copilotItems } from "./schema";
import type { CopilotItemRow } from "./schema";

export type CopilotItemKind = "flag" | "request";
export type CopilotItemStatus = "pending" | "handled" | "done" | "blocked";
export type CopilotCategory = "trisha" | "job_search" | "boy_scouts" | "events" | "other" | "system";

export type CalendarEventPayload = {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or "" for all-day
  location: string;
  notes: string;
};

/** Bot flags something it noticed, or queues a request (from chat or a bot suggestion) for the next hourly run. */
export async function createCopilotItem(input: {
  kind: CopilotItemKind;
  category?: string;
  title: string;
  body?: string;
  sourceLink?: string;
  requestType?: string;
  calendarEvent?: CalendarEventPayload | null;
  createdBy?: string;
}): Promise<CopilotItemRow> {
  const db = getDb();
  const [row] = await db
    .insert(copilotItems)
    .values({
      kind: input.kind,
      category: (input.category || "other").slice(0, 64),
      title: input.title.slice(0, 300),
      body: (input.body || "").slice(0, 4000),
      sourceLink: (input.sourceLink || "").slice(0, 1000),
      requestType: (input.requestType || "").slice(0, 32),
      calendarEvent: input.calendarEvent ?? null,
      createdBy: (input.createdBy || "").slice(0, 32),
    })
    .returning();
  return row;
}

export async function listCopilotItems(
  opts: {
    kind?: CopilotItemKind;
    status?: CopilotItemStatus;
    category?: string;
    limit?: number;
  } = {},
): Promise<CopilotItemRow[]> {
  const db = getDb();
  const conditions = [];
  if (opts.kind) conditions.push(eq(copilotItems.kind, opts.kind));
  if (opts.status) conditions.push(eq(copilotItems.status, opts.status));
  if (opts.category) conditions.push(eq(copilotItems.category, opts.category));
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  return db
    .select()
    .from(copilotItems)
    .where(whereClause)
    .orderBy(desc(copilotItems.createdAt))
    .limit(limit);
}

export async function getCopilotItem(id: string): Promise<CopilotItemRow | null> {
  const db = getDb();
  const [row] = await db.select().from(copilotItems).where(eq(copilotItems.id, id)).limit(1);
  return row ?? null;
}

export async function updateCopilotItemStatus(
  id: string,
  input: { status: CopilotItemStatus; resultNote?: string },
): Promise<CopilotItemRow | null> {
  const db = getDb();
  const [row] = await db
    .update(copilotItems)
    .set({
      status: input.status,
      ...(input.resultNote !== undefined ? { resultNote: input.resultNote.slice(0, 2000) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(copilotItems.id, id))
    .returning();
  return row ?? null;
}

/** Pending instructions queued for the hourly bot's next run (from chat, or a bot self-suggestion). */
export async function listPendingRequests(): Promise<CopilotItemRow[]> {
  return listCopilotItems({ kind: "request", status: "pending", limit: 50 });
}
