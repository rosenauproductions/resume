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
  shortName: string;
  location: string;
  dateApplied: string; // YYYY-MM-DD or ""
  rate: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: "annual" | "hourly" | "daily" | "";
  annualMid: number | null; // normalized annual midpoint when possible
  status: JobStatus;
  statusRaw: string;
  description: string;
  source: string;
  tags: string[];
  strongMatches: string[];
  gaps: string[];
  matchScore: number | null; // 0–10
  matchLevel: string;
  notes: string;
  url: string;
  department: string;
  employmentType: string;
  interviewDate: string;
  interviewNotes: string;
  isTarget: boolean;
  updatedAt: string;
};

export type TrackerMeta = {
  lastUpdated: string;
  candidateName: string;
  location: string;
  preferredEmployment: string;
  lastSalary: number;
  preferredTarget: string;
  highValueTarget: string;
  preferredWork: string[];
  lessPreferred: string[];
  risks: string[];
  strengths: string[];
  targets: { company: string; reason: string }[];
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
  considering: "researching",
  discussed: "researching",
  "not submitted": "researching",
  draft: "researching",
  applied: "applied",
  pending: "applied",
  submitted: "applied",
  "re-applied": "applied",
  reapplied: "applied",
  screen: "screen",
  screening: "screen",
  interview: "interview",
  interviewed: "interview",
  offer: "offer",
  rejected: "rejected",
  rejection: "rejected",
  declined: "rejected",
  withdrawn: "withdrawn",
  avoid: "avoid",
  skip: "avoid",
};

export function createEmptyJob(partial?: Partial<JobApplication>): JobApplication {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    company: "",
    shortName: "",
    location: "",
    dateApplied: now.slice(0, 10),
    rate: "",
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: "",
    annualMid: null,
    status: "researching",
    statusRaw: "",
    description: "",
    source: "",
    tags: [],
    strongMatches: [],
    gaps: [],
    matchScore: null,
    matchLevel: "",
    notes: "",
    url: "",
    department: "",
    employmentType: "",
    interviewDate: "",
    interviewNotes: "",
    isTarget: false,
    updatedAt: now,
    ...partial,
  };
}

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

function canonicalizeRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const norm = key.trim().toLowerCase().replace(/[\s_-]+/g, "");
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

function asStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function asNotes(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((n) => String(n).trim()).filter(Boolean).join("\n");
  return String(raw ?? "").trim();
}

function mapStatus(raw: unknown): JobStatus {
  const text = String(raw ?? "applied").trim().toLowerCase();
  if (isJobStatus(text)) return text;
  if (text.includes("reject")) return "rejected";
  if (text.includes("interview")) return "interview";
  if (text.includes("offer")) return "offer";
  if (text.includes("withdraw")) return "withdrawn";
  if (
    text.includes("consider") ||
    text.includes("discuss") ||
    text.includes("not confirmed") ||
    text.includes("proposed")
  ) {
    return "researching";
  }
  if (text.includes("applied") || text.includes("re-applied") || text.includes("pending")) {
    return "applied";
  }
  for (const [alias, status] of Object.entries(STATUS_ALIASES)) {
    if (text.includes(alias)) return status;
  }
  return "applied";
}

function parseMatchScore(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw ?? "").trim();
  if (!text || /unknown/i.test(text)) return null;
  const m = text.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.min(10, n) : null;
}

type SalaryBag = {
  min: number | null;
  max: number | null;
  period: "annual" | "hourly" | "daily" | "";
  rateLabel: string;
  annualMid: number | null;
};

function parseSalary(o: Record<string, unknown>): SalaryBag {
  const salary = pick(o, "salary", "compensation");
  let min: number | null = null;
  let max: number | null = null;
  let period: SalaryBag["period"] = "";
  let rateLabel = "";

  if (salary && typeof salary === "object" && !Array.isArray(salary)) {
    const s = salary as Record<string, unknown>;
    const amount = s.amount;
    const minRaw = s.min;
    const maxRaw = s.max;
    const standard = s.standard_rate;
    const periodRaw = String(s.period ?? "").toLowerCase();

    if (typeof amount === "number") {
      min = amount;
      max = amount;
    }
    if (typeof minRaw === "number") min = minRaw;
    if (typeof maxRaw === "number") max = maxRaw;
    if (typeof standard === "number" && min == null && max == null) {
      min = standard;
      max = standard;
    }

    if (periodRaw.includes("hour")) period = "hourly";
    else if (periodRaw.includes("day")) period = "daily";
    else if (periodRaw.includes("annual") || periodRaw.includes("year")) period = "annual";
    else if (min != null && min < 200) period = "hourly";
    else if (min != null || max != null) period = "annual";
  } else {
    const rateStr = String(pick(o, "rate", "salary") ?? "").trim();
    rateLabel = rateStr;
    const nums = [...rateStr.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    if (nums.length === 1) {
      min = nums[0];
      max = nums[0];
    } else if (nums.length >= 2) {
      min = Math.min(nums[0], nums[1]);
      max = Math.max(nums[0], nums[1]);
    }
    if (/hr|hour/i.test(rateStr)) period = "hourly";
    else if (/day/i.test(rateStr)) period = "daily";
    else if (min != null && min >= 1000) period = "annual";
  }

  if (!rateLabel) {
    if (min != null && max != null && min !== max) {
      rateLabel =
        period === "hourly"
          ? `$${min}–$${max}/hr`
          : period === "daily"
            ? `$${min}–$${max}/day`
            : `$${min.toLocaleString()}–$${max.toLocaleString()}`;
    } else if (min != null || max != null) {
      const v = min ?? max!;
      rateLabel =
        period === "hourly"
          ? `$${v}/hr`
          : period === "daily"
            ? `$${v}/day`
            : `$${v.toLocaleString()}`;
    }
  }

  let annualMid: number | null = null;
  if (min != null || max != null) {
    const mid = ((min ?? max!) + (max ?? min!)) / 2;
    if (period === "hourly") annualMid = mid * 40 * 52;
    else if (period === "daily") annualMid = mid * 12; // light estimate
    else annualMid = mid;
  }

  return { min, max, period, rateLabel, annualMid };
}

/** Accepts tracker exports, applications arrays, PascalCase, etc. */
export function extractJobRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const tracker = root.job_application_tracker;
  if (tracker && typeof tracker === "object") {
    const t = tracker as Record<string, unknown>;
    if (Array.isArray(t.applications)) return t.applications;
  }
  const o = canonicalizeRecord(root);
  if (Array.isArray(o.applications)) return o.applications as unknown[];
  if (Array.isArray(o.jobs)) return o.jobs as unknown[];
  if (pick(o, "company", "title", "position")) return [payload];
  return [];
}

export function extractTrackerMeta(payload: unknown): Partial<TrackerMeta> | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const tracker =
    root.job_application_tracker && typeof root.job_application_tracker === "object"
      ? (root.job_application_tracker as Record<string, unknown>)
      : root;

  const candidate =
    tracker.candidate && typeof tracker.candidate === "object"
      ? (tracker.candidate as Record<string, unknown>)
      : {};
  const strategy =
    tracker.career_strategy && typeof tracker.career_strategy === "object"
      ? (tracker.career_strategy as Record<string, unknown>)
      : {};
  const salaryContext =
    strategy.salary_context && typeof strategy.salary_context === "object"
      ? (strategy.salary_context as Record<string, unknown>)
      : {};
  const profile =
    tracker.professional_profile && typeof tracker.professional_profile === "object"
      ? (tracker.professional_profile as Record<string, unknown>)
      : {};

  const targetsRaw = Array.isArray(tracker.notable_current_targets)
    ? tracker.notable_current_targets
    : [];

  return {
    lastUpdated: String(tracker.last_updated ?? ""),
    candidateName: String(candidate.name ?? ""),
    location: String(candidate.location ?? ""),
    preferredEmployment: String(
      candidate.preferred_employment_type ?? strategy.employment_preference ?? "",
    ),
    lastSalary: Number(candidate.last_salary ?? salaryContext.previous_salary ?? 79000),
    preferredTarget: String(salaryContext.preferred_general_target ?? ""),
    highValueTarget: String(salaryContext.high_value_target ?? ""),
    preferredWork: asStringList(strategy.preferred_work),
    lessPreferred: asStringList(strategy.less_preferred),
    risks: asStringList(tracker.important_application_risks),
    strengths: asStringList(profile.strengths),
    targets: targetsRaw
      .map((t) => {
        if (!t || typeof t !== "object") return null;
        const o = t as Record<string, unknown>;
        return {
          company: String(o.company ?? ""),
          reason: String(o.reason ?? ""),
        };
      })
      .filter((t): t is { company: string; reason: string } => Boolean(t?.company)),
  };
}

export function normalizeJob(raw: unknown, targets: string[] = []): JobApplication | null {
  if (!raw || typeof raw !== "object") return null;
  const o = canonicalizeRecord(raw as Record<string, unknown>);

  const title = String(pick(o, "title", "position", "role") ?? "").trim();
  const company = String(pick(o, "company", "where") ?? "").trim();
  if (!title && !company) return null;

  const dateRaw = pick(o, "dateapplied", "applied", "applieddate", "applicationdate", "date");
  const dateApplied =
    dateRaw && !/unknown/i.test(String(dateRaw)) ? String(dateRaw).slice(0, 10) : "";

  const salary = parseSalary(o);
  const strongMatches = asStringList(pick(o, "strongmatches", "tags"));
  const gaps = [
    ...asStringList(pick(o, "potentialgaps", "gaps")),
    ...asStringList(pick(o, "majorgap")),
  ];
  const statusRaw = String(pick(o, "applicationstatus", "status") ?? "");
  const shortName = String(pick(o, "shortname") ?? "").trim();
  const companyKey = (shortName || company).toLowerCase();
  const isTarget = targets.some((t) => {
    const key = t.toLowerCase();
    return companyKey.includes(key) || company.toLowerCase().includes(key) || key.includes(companyKey);
  });

  const interview =
    pick(o, "interview") && typeof pick(o, "interview") === "object"
      ? (pick(o, "interview") as Record<string, unknown>)
      : null;

  const interviewDate = interview ? String(interview.date ?? "") : "";
  const interviewNotes = interview
    ? [interview.time, interview.platform, interview.recruiter]
        .filter(Boolean)
        .map(String)
        .join(" · ")
    : "";

  const noteParts = [
    asNotes(pick(o, "notes")),
    pick(o, "client") ? `Client: ${pick(o, "client")}` : "",
    pick(o, "project") ? `Project: ${pick(o, "project")}` : "",
    pick(o, "security") ? `Security: ${pick(o, "security")}` : "",
    pick(o, "travel") ? `Travel: ${pick(o, "travel")}` : "",
    asStringList(pick(o, "benefits")).length
      ? `Benefits: ${asStringList(pick(o, "benefits")).join(", ")}`
      : "",
    asStringList(pick(o, "technology")).length
      ? `Tech: ${asStringList(pick(o, "technology")).join(", ")}`
      : "",
  ];

  return {
    id: String(pick(o, "id") ?? crypto.randomUUID()),
    title: title || "Untitled role",
    company: company || "Unknown company",
    shortName,
    location: String(pick(o, "location") ?? "").trim(),
    dateApplied,
    rate: salary.rateLabel,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryPeriod: salary.period,
    annualMid: salary.annualMid,
    status: mapStatus(statusRaw),
    statusRaw,
    description: String(pick(o, "description", "department", "project") ?? "").trim(),
    source: String(pick(o, "source", "applicationmethod") ?? "").trim(),
    tags: [...new Set([...strongMatches.slice(0, 8), ...asStringList(pick(o, "tags"))])],
    strongMatches,
    gaps,
    matchScore: parseMatchScore(pick(o, "matchscoreestimate", "matchscore")),
    matchLevel: String(pick(o, "matchlevel") ?? "").trim(),
    notes: noteParts.filter(Boolean).join("\n"),
    url: String(pick(o, "url", "joburl", "link") ?? "").trim(),
    department: String(pick(o, "department") ?? "").trim(),
    employmentType: String(pick(o, "employmenttype", "workarrangement") ?? "").trim(),
    interviewDate,
    interviewNotes,
    isTarget,
    updatedAt: String(pick(o, "updatedat") ?? new Date().toISOString()),
  };
}
