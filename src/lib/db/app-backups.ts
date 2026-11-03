/**
 * Pipeline backups — point-in-time copies of the `applications` table, stored as
 * rows in `site_settings` (no migration needed):
 *   - `applications_backup:<ISO time>` → { createdAt, reason, count, jobs }
 *   - `applications_trash`             → { items: [{ deletedAt, job }] }  (single deletes)
 *
 * Snapshots are taken automatically before any destructive replace, at most hourly
 * before routine replaces, daily by cron, before every restore, and on demand.
 */
import { desc, eq, inArray, like } from "drizzle-orm";
import { getDb } from "./index";
import { siteSettings } from "./schema";
import type { JobApplication } from "@/lib/jobs/types";

export const BACKUP_PREFIX = "applications_backup:";
const TRASH_KEY = "applications_trash";
const KEEP_SNAPSHOTS = 60;
const KEEP_TRASH = 200;
const ROUTINE_MIN_GAP_MS = 60 * 60 * 1000;

export type BackupSummary = {
  id: string;
  createdAt: string;
  reason: string;
  count: number;
};

export type TrashItem = { deletedAt: string; job: JobApplication };

type StoredBackup = {
  createdAt: string;
  reason: string;
  count: number;
  jobs: JobApplication[];
};

function fingerprint(jobs: JobApplication[]): string {
  return JSON.stringify(
    [...jobs]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((j) => ({ ...j, updatedAt: "" })),
  );
}

async function latestBackup(): Promise<(StoredBackup & { id: string }) | null> {
  const db = getDb();
  const rows = await db
    .select({ key: siteSettings.key, valueJson: siteSettings.valueJson })
    .from(siteSettings)
    .where(like(siteSettings.key, `${BACKUP_PREFIX}%`))
    .orderBy(desc(siteSettings.key))
    .limit(1);
  if (!rows[0]) return null;
  return { id: rows[0].key, ...(rows[0].valueJson as unknown as StoredBackup) };
}

async function prune() {
  const db = getDb();
  const rows = await db
    .select({ key: siteSettings.key })
    .from(siteSettings)
    .where(like(siteSettings.key, `${BACKUP_PREFIX}%`))
    .orderBy(desc(siteSettings.key));
  const stale = rows.slice(KEEP_SNAPSHOTS).map((r) => r.key);
  if (stale.length) {
    await db.delete(siteSettings).where(inArray(siteSettings.key, stale));
  }
}

/**
 * Save a copy of the given rows. Skips empty tables and exact duplicates of the
 * latest snapshot (unless `force`). Returns the new backup id, or null if skipped.
 */
export async function saveBackup(
  jobs: JobApplication[],
  reason: string,
  opts: { force?: boolean; minGapMs?: number } = {},
): Promise<string | null> {
  if (!jobs.length) return null;
  const last = await latestBackup();
  if (last && !opts.force) {
    if (fingerprint(last.jobs ?? []) === fingerprint(jobs)) return null;
    if (opts.minGapMs && Date.now() - new Date(last.createdAt).getTime() < opts.minGapMs) {
      return null;
    }
  }
  const createdAt = new Date().toISOString();
  const id = `${BACKUP_PREFIX}${createdAt}`;
  const value: StoredBackup = { createdAt, reason, count: jobs.length, jobs };
  const db = getDb();
  await db
    .insert(siteSettings)
    .values({ key: id, valueJson: value as unknown as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoNothing();
  await prune();
  return id;
}

/**
 * Called right before the table is replaced. Always snapshots when the replace would
 * remove existing rows; otherwise at most once an hour so routine UI saves don't
 * crowd out older snapshots.
 */
export async function backupBeforeReplace(current: JobApplication[], incoming: JobApplication[]) {
  if (!current.length) return null;
  const incomingIds = new Set(incoming.map((j) => j.id).filter(Boolean));
  const removed = current.filter((j) => !incomingIds.has(j.id)).length;
  if (removed > 0) {
    return saveBackup(
      current,
      `Auto: before replace that removed ${removed} of ${current.length} applications`,
      { force: true },
    );
  }
  return saveBackup(current, "Auto: before routine save (hourly)", { minGapMs: ROUTINE_MIN_GAP_MS });
}

export async function listBackups(): Promise<BackupSummary[]> {
  const db = getDb();
  const rows = await db
    .select({ key: siteSettings.key, valueJson: siteSettings.valueJson })
    .from(siteSettings)
    .where(like(siteSettings.key, `${BACKUP_PREFIX}%`))
    .orderBy(desc(siteSettings.key));
  return rows.map((r) => {
    const v = r.valueJson as unknown as StoredBackup;
    return { id: r.key, createdAt: v.createdAt, reason: v.reason, count: v.count };
  });
}

export async function getBackupJobs(id: string): Promise<JobApplication[] | null> {
  if (!id.startsWith(BACKUP_PREFIX)) return null;
  const db = getDb();
  const rows = await db
    .select({ valueJson: siteSettings.valueJson })
    .from(siteSettings)
    .where(eq(siteSettings.key, id))
    .limit(1);
  if (!rows[0]) return null;
  return ((rows[0].valueJson as unknown as StoredBackup).jobs ?? []) as JobApplication[];
}

async function readTrash(): Promise<TrashItem[]> {
  const db = getDb();
  const rows = await db
    .select({ valueJson: siteSettings.valueJson })
    .from(siteSettings)
    .where(eq(siteSettings.key, TRASH_KEY))
    .limit(1);
  const items = (rows[0]?.valueJson as { items?: TrashItem[] } | undefined)?.items;
  return Array.isArray(items) ? items : [];
}

async function writeTrash(items: TrashItem[]) {
  const db = getDb();
  const value = { items: items.slice(0, KEEP_TRASH) } as unknown as Record<string, unknown>;
  await db
    .insert(siteSettings)
    .values({ key: TRASH_KEY, valueJson: value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { valueJson: value, updatedAt: new Date() } });
}

/** Keep a copy of a single deleted application so it can be put back. */
export async function addToTrash(job: JobApplication) {
  const items = await readTrash();
  await writeTrash([{ deletedAt: new Date().toISOString(), job }, ...items]);
}

export async function listTrash(): Promise<TrashItem[]> {
  return readTrash();
}

/** Remove an item from the trash and return its job (caller re-inserts it). */
export async function takeFromTrash(jobId: string): Promise<JobApplication | null> {
  const items = await readTrash();
  const idx = items.findIndex((i) => i.job?.id === jobId);
  if (idx < 0) return null;
  const [item] = items.splice(idx, 1);
  await writeTrash(items);
  return item.job;
}
