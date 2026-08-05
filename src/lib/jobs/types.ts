export const JOB_STATUSES = [
  "researching",
  "applied",
  "screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "avoid",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobApplication = {
  id: string;
  title: string;
  company: string;
  location: string;
  dateApplied: string; // YYYY-MM-DD
  rate: string;
  status: JobStatus;
  description: string;
  source: string;
  tags: string[];
  notes: string;
  url: string;
  updatedAt: string; // ISO
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  researching: "Researching",
  applied: "Applied",
  screen: "Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  avoid: "Avoid",
};

export const BOARD_COLUMNS: JobStatus[] = [
  "researching",
  "applied",
  "screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "avoid",
];

const STATUS_ALIASES: Record<string, JobStatus> = {
  researching: "researching",
  research: "researching",
  "not submitted": "researching",
  not_submitted: "researching",
  draft: "researching",
  applied: "applied",
  pending: "applied",
  submitted: "applied",
  application: "applied",
  screen: "screen",
  screening: "screen",
  phone: "screen",
  "phone screen": "screen",
  interview: "interview",
  interviewing: "interview",
  offer: "offer",
  rejected: "rejected",
  rejection: "rejected",
  declined: "rejected",
  withdrawn: "withdrawn",
  withdrew: "withdrawn",
  avoid: "avoid",
  skip: "avoid",
};

export function createEmptyJob(partial?: Partial<JobApplication>): JobApplication {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    company: "",
    location: "",
    dateApplied: now.slice(0, 10),
    rate: "",
    status: "researching",
    description: "",
    source: "",
    tags: [],
    notes: "",
    url: "",
    updatedAt: now,
    ...partial,
  };
}

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

function mapStatus(raw: unknown): JobStatus {
  const key = String(raw ?? "applied")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (isJobStatus(key)) return key;
  return STATUS_ALIASES[key] ?? "applied";
}

function asNotes(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((n) => String(n).trim()).filter(Boolean).join("\n");
  }
  return String(raw ?? "").trim();
}

function inferTags(o: Record<string, unknown>, title: string): string[] {
  const tags = Array.isArray(o.tags)
    ? o.tags.map((t) => String(t).trim()).filter(Boolean)
    : typeof o.tags === "string"
      ? o.tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
      : [];

  const extras: string[] = [];
  const employment = String(o.employment ?? "").trim();
  if (employment) extras.push(employment);

  const hay = `${title} ${employment}`.toLowerCase();
  if (/\blms\b/.test(hay)) extras.push("LMS");
  if (/instructional design|instructional designer/.test(hay)) extras.push("Instructional Design");
  if (/elearning|e-learning/.test(hay)) extras.push("eLearning");
  if (/multimedia|video|videographer|vfx/.test(hay)) extras.push("Multimedia");
  if (/program manager|coordinator/.test(hay)) extras.push("Program");

  return [...new Set([...tags, ...extras])];
}

/** Accepts our schema or ChatGPT tracker exports (`applications`, `position`, Pending, etc.). */
export function extractJobRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  if (Array.isArray(o.applications)) return o.applications;
  if (Array.isArray(o.jobs)) return o.jobs;
  if (o.company || o.title || o.position) return [o];
  return [];
}

export function normalizeJob(raw: unknown): JobApplication | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? o.position ?? o.role ?? "").trim();
  const company = String(o.company ?? o.where ?? "").trim();
  if (!title && !company) return null;

  const dateApplied = String(
    o.dateApplied ?? o.applied_date ?? o.date ?? o.rejection_date ?? new Date().toISOString().slice(0, 10),
  ).slice(0, 10);

  const noteParts = [asNotes(o.notes)];
  if (o.job_req) noteParts.push(`Req: ${o.job_req}`);
  if (o.hours) noteParts.push(`Hours: ${o.hours}`);
  if (o.employment) noteParts.push(`Employment: ${o.employment}`);
  if (o.rejection_date && !o.applied_date && !o.dateApplied) {
    noteParts.push(`Rejection date: ${o.rejection_date}`);
  }

  const url = String(o.url ?? o.job_url ?? o.link ?? "").trim();

  return {
    id: String(o.id ?? crypto.randomUUID()),
    title: title || "Untitled role",
    company: company || "Unknown company",
    location: String(o.location ?? "").trim(),
    dateApplied,
    rate: String(o.rate ?? o.salary ?? "").trim(),
    status: mapStatus(o.status),
    description: String(o.description ?? o.roleDescription ?? o.jd ?? "").trim(),
    source: String(o.source ?? o.employment ?? "").trim(),
    tags: inferTags(o, title),
    notes: noteParts.filter(Boolean).join("\n"),
    url: url || "",
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
  };
}
