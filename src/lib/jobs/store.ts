import { put, list } from "@vercel/blob";
import type { JobApplication } from "./types";
import { normalizeJob } from "./types";
import { getTrackerSecret, hashSecret } from "./auth";

function blobPathname() {
  const secret = getTrackerSecret();
  const slug = secret ? hashSecret(secret).slice(0, 16) : "local";
  return `pipeline/${slug}-jobs.json`;
}

export function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function loadJobsFromBlob(): Promise<JobApplication[] | null> {
  if (!blobConfigured()) return null;
  const pathname = blobPathname();
  try {
    const result = await list({ prefix: "pipeline/", limit: 50 });
    const file = result.blobs.find((b) => b.pathname === pathname);
    if (!file?.url) return [];
    const res = await fetch(file.url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data.map(normalizeJob).filter((j): j is JobApplication => Boolean(j));
  } catch (error) {
    console.error("loadJobsFromBlob", error);
    return [];
  }
}

export async function saveJobsToBlob(jobs: JobApplication[]) {
  if (!blobConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN not configured");
  }
  await put(blobPathname(), JSON.stringify(jobs, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
