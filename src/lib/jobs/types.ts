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

/** Normalize keys so Company / company / COMPANY / applied_date all match. */
function canonicalizeRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const norm = key
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    if (!(norm in out) || out[norm] === "" || out[norm] == null) {
      out[norm] = value;
    }
  }
  return out;
}

function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = o[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return undefined;
}

function inferTags(o: Record<string, unknown>, title: string, employment: string): string[] {
  const tagsRaw = o.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
    : typeof tagsRaw === "string"
      ? tagsRaw.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
      : [];

  const extras: string[] = [];
  if (employment) extras.push(employment);

  const hay = `${title} ${employment}`.toLowerCase();
  if (/\blms\b/.test(hay)) extras.push("LMS");
  if (/instructional design|instructional designer/.test(hay)) extras.push("Instructional Design");
  if (/elearning|e-learning/.test(hay)) extras.push("eLearning");
  if (/multimedia|video|videographer|vfx/.test(hay)) extras.push("Multimedia");
  if (/program manager|coordinator/.test(hay)) extras.push("Program");

  return [...new Set([...tags, ...extras])];
}

/** Accepts our schema or ChatGPT tracker exports (`applications`, PascalCase, Pending, etc.). */
export function extractJobRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const o = canonicalizeRecord(payload as Record<string, unknown>);
  if (Array.isArray(o.applications)) return o.applications as unknown[];
  if (Array.isArray(o.jobs)) return o.jobs as unknown[];
  if (pick(o, "company", "title", "position")) return [payload];
  return [];
}

export function normalizeJob(raw: unknown): JobApplication | null {
  if (!raw || typeof raw !== "object") return null;
  const o = canonicalizeRecord(raw as Record<string, unknown>);

  const title = String(pick(o, "title", "position", "role") ?? "").trim();
  const company = String(pick(o, "company", "where") ?? "").trim();
  if (!title && !company) return null;

  const dateRaw = pick(
    o,
    "dateapplied",
    "applied",
    "applieddate",
    "date",
    "rejectiondate",
  );
  const dateApplied = dateRaw
    ? String(dateRaw).slice(0, 10)
    : "";

  const employment = String(pick(o, "type", "employment") ?? "").trim();
  const reqId = pick(o, "reqid", "jobreq", "req");
  const hours = pick(o, "hours");

  const noteParts = [asNotes(pick(o, "notes"))];
  if (reqId) noteParts.push(`Req: ${reqId}`);
  if (hours) noteParts.push(`Hours: ${hours}`);
  if (employment) noteParts.push(`Employment: ${employment}`);

  const url = String(pick(o, "url", "joburl", "link") ?? "").trim();
  const source = String(pick(o, "source") ?? employment ?? "").trim();

  return {
    id: String(pick(o, "id") ?? crypto.randomUUID()),
    title: title || "Untitled role",
    company: company || "Unknown company",
    location: String(pick(o, "location") ?? "").trim(),
    dateApplied,
    rate: String(pick(o, "rate", "salary") ?? "").trim(),
    status: mapStatus(pick(o, "status")),
    description: String(pick(o, "description", "roledescription", "jd") ?? "").trim(),
    source,
    tags: inferTags(o, title, employment),
    notes: noteParts.filter(Boolean).join("\n"),
    url,
    updatedAt: String(pick(o, "updatedat") ?? new Date().toISOString()),
  };
}
