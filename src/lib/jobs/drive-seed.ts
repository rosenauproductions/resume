import {
  parseTrackerPayload,
  type JobApplication,
  type TrackerMeta,
} from "./types";
import { loadSeedMeta } from "./seed";

export function getDriveSeedConfig() {
  const fileId = process.env.JOB_TRACKER_DRIVE_FILE_ID?.trim() || "";
  const seedUrl = process.env.JOB_TRACKER_SEED_URL?.trim() || "";
  return { fileId, seedUrl, configured: Boolean(fileId || seedUrl) };
}

function extractDriveFileId(urlOrId: string): string {
  const text = urlOrId.trim();
  if (!text) return "";
  if (/^[\w-]{20,}$/.test(text) && !text.includes("/")) return text;
  const fromPath = text.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fromPath?.[1]) return fromPath[1];
  const fromQuery = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery?.[1]) return fromQuery[1];
  return "";
}

function driveDownloadUrl(fileId: string, confirm?: string) {
  const base = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  return confirm ? `${base}&confirm=${encodeURIComponent(confirm)}` : base;
}

async function fetchDriveText(fileId: string): Promise<string> {
  const first = await fetch(driveDownloadUrl(fileId), {
    redirect: "follow",
    cache: "no-store",
    headers: { "User-Agent": "resume-pipeline-seed/1.0" },
  });
  if (!first.ok) {
    throw new Error(`Google Drive returned HTTP ${first.status}`);
  }

  let text = await first.text();

  // Large files can hit Drive's virus-scan interstitial HTML
  if (/<!doctype html>|<html/i.test(text) && /confirm=/i.test(text)) {
    const confirm =
      text.match(/confirm=([0-9A-Za-z_]+)/)?.[1] ||
      text.match(/name="confirm"\s+value="([^"]+)"/)?.[1] ||
      "t";
    const second = await fetch(driveDownloadUrl(fileId, confirm), {
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "resume-pipeline-seed/1.0" },
    });
    if (!second.ok) {
      throw new Error(`Google Drive confirm download returned HTTP ${second.status}`);
    }
    text = await second.text();
  }

  if (/<!doctype html>|<html/i.test(text)) {
    throw new Error(
      "Drive returned HTML instead of JSON. Share the file as Anyone with the link → Viewer.",
    );
  }

  return text;
}

export async function fetchRemoteTrackerJson(): Promise<unknown> {
  const { fileId, seedUrl } = getDriveSeedConfig();

  if (seedUrl && !fileId) {
    // Allow a direct JSON URL (Drive download link or other host)
    const id = extractDriveFileId(seedUrl);
    const text = id
      ? await fetchDriveText(id)
      : await (async () => {
          const res = await fetch(seedUrl, { cache: "no-store", redirect: "follow" });
          if (!res.ok) throw new Error(`Seed URL returned HTTP ${res.status}`);
          return res.text();
        })();
    return JSON.parse(text) as unknown;
  }

  const id = fileId || extractDriveFileId(seedUrl);
  if (!id) {
    throw new Error("JOB_TRACKER_DRIVE_FILE_ID (or JOB_TRACKER_SEED_URL) is not configured");
  }

  const text = await fetchDriveText(id);
  return JSON.parse(text) as unknown;
}

export function completeTrackerMeta(partial: Partial<TrackerMeta> | null): TrackerMeta {
  const fallback = loadSeedMeta();
  return {
    lastUpdated: partial?.lastUpdated || fallback.lastUpdated,
    candidateName: partial?.candidateName || fallback.candidateName,
    location: partial?.location || fallback.location,
    preferredEmployment: partial?.preferredEmployment || fallback.preferredEmployment,
    lastSalary: partial?.lastSalary || fallback.lastSalary,
    preferredTarget: partial?.preferredTarget || fallback.preferredTarget,
    highValueTarget: partial?.highValueTarget || fallback.highValueTarget,
    preferredWork: partial?.preferredWork?.length ? partial.preferredWork : fallback.preferredWork,
    lessPreferred: partial?.lessPreferred?.length ? partial.lessPreferred : fallback.lessPreferred,
    risks: partial?.risks?.length ? partial.risks : fallback.risks,
    strengths: partial?.strengths?.length ? partial.strengths : fallback.strengths,
    targets: partial?.targets?.length ? partial.targets : fallback.targets,
    datePolicy: partial?.datePolicy || fallback.datePolicy,
  };
}

export async function loadJobsFromDrive(): Promise<{
  jobs: JobApplication[];
  meta: TrackerMeta;
  source: "drive";
  fetchedAt: string;
}> {
  const payload = await fetchRemoteTrackerJson();
  const { jobs, meta } = parseTrackerPayload(payload);
  if (!jobs.length) {
    throw new Error("No applications found in Drive JSON");
  }
  return {
    jobs,
    meta: completeTrackerMeta(meta),
    source: "drive",
    fetchedAt: new Date().toISOString(),
  };
}
