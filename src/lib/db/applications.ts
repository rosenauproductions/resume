import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { applications, type ApplicationRow } from "./schema";
import {
  createEmptyJob,
  isJobStatus,
  type JobApplication,
  type JobStatus,
} from "@/lib/jobs/types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

export function rowToJob(row: ApplicationRow): JobApplication {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    shortName: row.shortName,
    location: row.location,
    dateApplied: row.dateApplied,
    dateDiscussed: row.dateDiscussed,
    datePrecision:
      row.datePrecision === "exact" ||
      row.datePrecision === "week_estimate" ||
      row.datePrecision === "unknown"
        ? row.datePrecision
        : "unknown",
    rate: row.rate,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryPeriod:
      row.salaryPeriod === "annual" ||
      row.salaryPeriod === "hourly" ||
      row.salaryPeriod === "daily"
        ? row.salaryPeriod
        : "",
    annualMid: row.annualMid,
    status: isJobStatus(row.status) ? row.status : "applied",
    statusRaw: row.statusRaw,
    description: row.description,
    source: row.source,
    tags: asStringArray(row.tags),
    strongMatches: asStringArray(row.strongMatches),
    gaps: asStringArray(row.gaps),
    matchScore: row.matchScore,
    matchLevel: row.matchLevel,
    userInterest: row.userInterest,
    notes: row.notes,
    url: row.url,
    department: row.department,
    employmentType: row.employmentType,
    interviewDate: row.interviewDate,
    interviewNotes: row.interviewNotes,
    isTarget: row.isTarget,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function jobToValues(job: JobApplication) {
  return {
    company: job.company.trim() || "Unknown company",
    title: job.title.trim() || "Untitled role",
    shortName: job.shortName || "",
    status: job.status,
    statusRaw: job.statusRaw || job.status,
    location: job.location || "",
    dateApplied: job.dateApplied || "",
    dateDiscussed: job.dateDiscussed || "",
    datePrecision: job.datePrecision || "unknown",
    rate: job.rate || "",
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryPeriod: job.salaryPeriod || "",
    annualMid: job.annualMid != null ? Math.round(job.annualMid) : null,
    matchScore: job.matchScore,
    matchLevel: job.matchLevel || "",
    userInterest: job.userInterest || "",
    description: job.description || "",
    source: job.source || "",
    url: job.url || "",
    department: job.department || "",
    employmentType: job.employmentType || "",
    interviewDate: job.interviewDate || "",
    interviewNotes: job.interviewNotes || "",
    notes: job.notes || "",
    tags: job.tags ?? [],
    strongMatches: job.strongMatches ?? [],
    gaps: job.gaps ?? [],
    isTarget: Boolean(job.isTarget),
    updatedAt: new Date(),
  };
}

export async function listApplications(): Promise<JobApplication[]> {
  const db = getDb();
  const rows = await db.select().from(applications).orderBy(desc(applications.updatedAt));
  return rows.map(rowToJob);
}

export async function countApplications(): Promise<number> {
  const db = getDb();
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(applications);
  return result[0]?.count ?? 0;
}

export async function getApplication(id: string): Promise<JobApplication | null> {
  const db = getDb();
  const rows = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
  return rows[0] ? rowToJob(rows[0]) : null;
}

/** Templated create with sensible defaults. */
export async function createApplication(
  partial: Partial<JobApplication> = {},
): Promise<JobApplication> {
  const template = createEmptyJob({
    status: "applied",
    datePrecision: partial.dateApplied ? "exact" : "unknown",
    ...partial,
  });
  const db = getDb();
  const values = jobToValues(template);
  const inserted = await db
    .insert(applications)
    .values({
      id: template.id,
      ...values,
      createdAt: new Date(),
    })
    .returning();
  return rowToJob(inserted[0]);
}

export async function updateApplication(
  id: string,
  partial: Partial<JobApplication>,
): Promise<JobApplication | null> {
  const existing = await getApplication(id);
  if (!existing) return null;
  const merged = { ...existing, ...partial, id, updatedAt: new Date().toISOString() };
  const db = getDb();
  const updated = await db
    .update(applications)
    .set(jobToValues(merged))
    .where(eq(applications.id, id))
    .returning();
  return updated[0] ? rowToJob(updated[0]) : null;
}

export async function deleteApplication(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db.delete(applications).where(eq(applications.id, id)).returning();
  return deleted.length > 0;
}

export async function replaceAllApplications(jobs: JobApplication[]): Promise<number> {
  const db = getDb();
  await db.delete(applications);
  if (!jobs.length) return 0;
  const rows = jobs.map((job) => {
    const values = jobToValues(job);
    return {
      id: job.id || crypto.randomUUID(),
      ...values,
      createdAt: new Date(),
    };
  });
  // Batch insert in chunks
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(applications).values(rows.slice(i, i + chunkSize));
  }
  return rows.length;
}

export async function upsertApplications(jobs: JobApplication[]): Promise<{
  inserted: number;
  updated: number;
}> {
  let inserted = 0;
  let updated = 0;
  const existing = await listApplications();
  const byKey = new Map(
    existing.map((j) => [`${j.company}::${j.title}`.toLowerCase().trim(), j]),
  );

  for (const job of jobs) {
    const key = `${job.company}::${job.title}`.toLowerCase().trim();
    const prev = byKey.get(key);
    if (prev) {
      await updateApplication(prev.id, { ...job, id: prev.id });
      updated += 1;
    } else {
      await createApplication(job);
      inserted += 1;
    }
  }
  return { inserted, updated };
}

export async function appendApplicationNote(id: string, noteLine: string): Promise<void> {
  const job = await getApplication(id);
  if (!job) return;
  const notes = job.notes?.trim()
    ? `${job.notes.trim()}\n${noteLine}`
    : noteLine;
  await updateApplication(id, { notes });
}

export async function listOpenApplicationsForAssociation(): Promise<JobApplication[]> {
  const all = await listApplications();
  const closed: JobStatus[] = ["rejected", "withdrawn", "avoid"];
  return all.filter((j) => !closed.includes(j.status));
}

export async function findApplicationByCompanyTitle(
  company: string,
  title: string,
): Promise<JobApplication | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(applications)
    .where(
      and(
        sql`lower(${applications.company}) = ${company.toLowerCase()}`,
        sql`lower(${applications.title}) = ${title.toLowerCase()}`,
      ),
    )
    .limit(1);
  return rows[0] ? rowToJob(rows[0]) : null;
}
