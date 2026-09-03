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
export type DatePrecision = "exact" | "week_estimate" | "unknown" | "";

export type JobApplication = {
  id: string;
  title: string;
  company: string;
  shortName: string;
  location: string;
  dateApplied: string; // YYYY-MM-DD or "" — submission date only
  dateDiscussed: string; // YYYY-MM-DD or "" — when posting was shared with ChatGPT
  datePrecision: DatePrecision;
  rate: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: "annual" | "hourly" | "daily" | "";
  annualMid: number | null;
  status: JobStatus;
  statusRaw: string;
  description: string;
  source: string;
  tags: string[];
  strongMatches: string[];
  gaps: string[];
  matchScore: number | null;
  matchLevel: string;
  userInterest: string;
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
  datePolicy: string;
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

export function createEmptyJob(partial?: Partial<JobApplication>): JobApplication {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    company: "",
    shortName: "",
    location: "",
    dateApplied: "",
    dateDiscussed: "",
    datePrecision: "unknown",
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
    userInterest: "",
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
    text.includes("previous_employment") ||
    text.includes("not_applied") ||
    text.includes("not applied") ||
    text.includes("application_in_progress") ||
    text.includes("in progress") ||
    text.includes("consider") ||
    text.includes("not_applicable") ||
    text.includes("not confirmed") ||
    text.includes("unknown - application") ||
    text.includes("application not confirmed") ||
    (text.includes("discussed") && !text.includes("applied"))
  ) {
    return "researching";
  }
  if (
    text.includes("applied") ||
    text.includes("re-applied") ||
    text.includes("pending") ||
    text.includes("considered")
  ) {
    return "applied";
  }
  return "applied";
}

/** Skip non-application tracker rows (e.g. prior employer listed in dumps). */
export function shouldSkipJobRecord(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return true;
  const o = canonicalizeRecord(raw as Record<string, unknown>);
  const status = String(pick(o, "applicationstatus", "status") ?? "")
    .trim()
    .toLowerCase();
  return status.includes("previous_employment") || status === "previous employment";
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

function parseDateField(raw: unknown): string {
  if (raw == null) return "";
  const text = String(raw).trim();
  if (!text || /unknown/i.test(text)) return "";
  return text.slice(0, 10);
}

function parseDatePrecision(raw: unknown): DatePrecision {
  const text = String(raw ?? "").trim().toLowerCase();
  if (text === "exact" || text === "week_estimate" || text === "unknown") return text;
  if (text === "not_applicable" || text === "n/a" || text === "na") return "unknown";
  return text ? "unknown" : "";
}

/** US state / territory → postal abbreviation for clean map location strings. */
const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  "washington dc": "DC",
  "washington d c": "DC",
};

function abbreviateRegion(raw: string): string {
  const n = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (!n) return "";
  if (/^[a-z]{2}$/i.test(n)) return n.toUpperCase();
  return US_STATE_ABBR[n] ?? raw.trim();
}

/** Normalize remote | hybrid | onsite from import aliases. Empty if unknown / invent-prone. */
export function normalizeWorkType(raw: unknown): "" | "remote" | "hybrid" | "onsite" {
  const text = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (!text) return "";
  if (/\bhybrid\b/.test(text)) return "hybrid";
  if (/\b(on\s*site|onsite|in\s*office|office)\b/.test(text)) return "onsite";
  if (/\b(remote|fully remote|us[- ]?remote|work from home|wfh)\b/.test(text)) return "remote";
  if (text === "remote" || text === "hybrid" || text === "onsite") return text;
  return "";
}

/** Strip remote/hybrid/onsite tags so composeLocation can re-apply work arrangement. */
export function stripWorkArrangement(location: string): string {
  return location
    .replace(/^\s*Hybrid\s*[·|,/\-]\s*/i, "")
    .replace(/\s*\/\s*Remote\s*$/i, "")
    .replace(/\s*[·|,/]\s*(remote|hybrid|on[-\s]?site)\s*$/i, "")
    .replace(/^(Remote|Hybrid|Onsite|On-site|On site)$/i, "")
    .trim();
}

/**
 * Build a geocode-friendly location string for Target map.
 * Prefers structured city/state/country; falls back to free-text `location`.
 * Never invents — only uses fields present on the record.
 */
export function composeLocation(fields: {
  location?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  workType?: unknown;
}): string {
  const free = String(fields.location ?? "").trim();
  const city = String(fields.city ?? "").trim();
  const stateRaw = String(fields.state ?? "").trim();
  const country = String(fields.country ?? "").trim();
  const workType = normalizeWorkType(fields.workType);

  if (city) {
    const state = abbreviateRegion(stateRaw);
    const place = [city, state].filter(Boolean).join(", ");
    if (workType === "hybrid") return `Hybrid · ${place}`;
    if (workType === "remote") return `${place} / Remote`;
    return place;
  }

  if (workType === "remote" && !free) return "Remote";

  if (free) {
    // If free text is pure remote and we also have hybrid/onsite, prefer work type label
    if (workType === "hybrid" && !/\bhybrid\b/i.test(free)) {
      return `Hybrid · ${free}`;
    }
    return free;
  }

  if (country && !city) {
    if (workType === "remote") return "Remote";
    return country;
  }

  if (workType === "remote") return "Remote";
  if (workType === "hybrid") return "Hybrid";
  if (workType === "onsite") return "Onsite";
  return "";
}

function readMinMaxObject(raw: unknown): { min: number | null; max: number | null } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { min: null, max: null };
  }
  const s = raw as Record<string, unknown>;
  const min = typeof s.min === "number" ? s.min : null;
  const max = typeof s.max === "number" ? s.max : null;
  return { min, max };
}

type SalaryBag = {
  min: number | null;
  max: number | null;
  period: "annual" | "hourly" | "daily" | "";
  rateLabel: string;
  annualMid: number | null;
};

function parseSalary(o: Record<string, unknown>): SalaryBag {
  const salary = pick(o, "salary", "compensation", "salaryrange");
  const hourly = pick(o, "hourlyrate");
  const daily = pick(o, "dailyrate");
  const salaryTarget = pick(o, "salarytarget");
  let min: number | null = null;
  let max: number | null = null;
  let period: SalaryBag["period"] = "";
  let rateLabel = "";

  if (hourly && typeof hourly === "object") {
    const mm = readMinMaxObject(hourly);
    min = mm.min;
    max = mm.max;
    period = "hourly";
  } else if (daily && typeof daily === "object") {
    const mm = readMinMaxObject(daily);
    min = mm.min;
    max = mm.max;
    period = "daily";
  } else if (typeof daily === "number") {
    min = daily;
    max = daily;
    period = "daily";
  } else if (salary && typeof salary === "object" && !Array.isArray(salary)) {
    const s = salary as Record<string, unknown>;
    const amount = s.amount ?? s.mentioned;
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
  } else if (typeof salaryTarget === "number") {
    min = salaryTarget;
    max = salaryTarget;
    period = "annual";
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
    else if (period === "daily") annualMid = mid * 12;
    else annualMid = mid;
  }

  return { min, max, period, rateLabel, annualMid };
}

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
  if (pick(o, "company", "title", "position", "role")) return [payload];
  return [];
}

export function extractTrackerMeta(payload: unknown): Partial<TrackerMeta> | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const tracker =
    root.job_application_tracker && typeof root.job_application_tracker === "object"
      ? (root.job_application_tracker as Record<string, unknown>)
      : root;

  const metaBlock =
    tracker.tracker_metadata && typeof tracker.tracker_metadata === "object"
      ? (tracker.tracker_metadata as Record<string, unknown>)
      : tracker;

  const candidate =
    tracker.candidate && typeof tracker.candidate === "object"
      ? (tracker.candidate as Record<string, unknown>)
      : tracker.user_profile_for_matching && typeof tracker.user_profile_for_matching === "object"
        ? (tracker.user_profile_for_matching as Record<string, unknown>)
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
      : candidate;

  const targetsRaw = Array.isArray(tracker.highest_priority_applications)
    ? tracker.highest_priority_applications
    : Array.isArray(tracker.notable_current_targets)
      ? tracker.notable_current_targets
      : [];

  const datePolicy =
    metaBlock.date_policy && typeof metaBlock.date_policy === "object"
      ? Object.entries(metaBlock.date_policy as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ")
      : String(metaBlock.important_instruction_for_next_ai ?? "");

  return {
    lastUpdated: String(metaBlock.last_updated ?? tracker.last_updated ?? ""),
    candidateName: String(metaBlock.user ?? candidate.name ?? ""),
    location: String(candidate.location ?? ""),
    preferredEmployment: String(
      candidate.preferred_work_type ??
        candidate.preferred_employment ??
        candidate.preferred_employment_type ??
        strategy.employment_preference ??
        "",
    ),
    lastSalary: Number(
      candidate.previous_salary ?? candidate.last_salary ?? salaryContext.previous_salary ?? 79000,
    ),
    preferredTarget: String(salaryContext.preferred_general_target ?? "Approximately $80K+ when possible"),
    highValueTarget: String(salaryContext.high_value_target ?? "$100K+ for strong senior/technical multimedia-ID roles"),
    preferredWork: asStringList(
      strategy.preferred_work ??
        candidate.strongest_role_types ??
        candidate.target_roles ??
        candidate.career_direction,
    ),
    lessPreferred: asStringList(strategy.less_preferred),
    risks: asStringList(tracker.important_application_risks ?? tracker.tracking_rules_for_future_updates),
    strengths: asStringList(profile.strengths ?? candidate.strengths),
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
    datePolicy,
  };
}

export function normalizeJob(raw: unknown, targets: string[] = []): JobApplication | null {
  if (!raw || typeof raw !== "object") return null;
  if (shouldSkipJobRecord(raw)) return null;
  const o = canonicalizeRecord(raw as Record<string, unknown>);

  const title = String(pick(o, "title", "position", "role") ?? "").trim();
  const company = String(pick(o, "company", "where") ?? "").trim();
  if (!title && !company) return null;

  const dateApplied = parseDateField(
    pick(o, "dateapplied", "applicationdate", "applied", "applieddate"),
  );
  const dateDiscussed = parseDateField(
    pick(
      o,
      "datediscussed",
      "datepostingsharedwithchatgpt",
      "discussedwithchatgptdate",
      "sharedwithchatgpt",
    ),
  );
  // Never fall back discussed → applied
  const datePrecision =
    parseDatePrecision(pick(o, "dateprecision", "applicationdateprecision")) ||
    (dateApplied ? "exact" : dateDiscussed ? "unknown" : "unknown");

  const salary = parseSalary(o);
  const strongMatches = asStringList(
    pick(o, "strongmatches", "keymatchreasons", "tags"),
  );
  const gaps = [
    ...asStringList(pick(o, "potentialgaps", "gaps", "concerns")),
    ...asStringList(pick(o, "majorgap")),
  ];
  const statusRaw = String(pick(o, "applicationstatus", "status") ?? "");
  const shortName = String(pick(o, "shortname") ?? "").trim();
  const companyKey = (shortName || company).toLowerCase();
  const isTarget = targets.some((t) => {
    const key = t.toLowerCase();
    return (
      companyKey.includes(key) ||
      company.toLowerCase().includes(key) ||
      key.includes(companyKey.split("(")[0].trim())
    );
  });

  const interview =
    pick(o, "interview") && typeof pick(o, "interview") === "object"
      ? (pick(o, "interview") as Record<string, unknown>)
      : null;

  const interviewDate =
    parseDateField(pick(o, "interviewdate")) ||
    (interview ? parseDateField(interview.date) : "");
  const interviewNotes = [
    pick(o, "interviewtime"),
    interview?.time,
    interview?.platform,
    pick(o, "recruiter"),
    interview?.recruiter,
  ]
    .filter(Boolean)
    .map(String)
    .join(" · ");

  const rejection =
    pick(o, "rejectionreason") || pick(o, "rejectiondate")
      ? [
          pick(o, "rejectiondate") ? `Rejected: ${pick(o, "rejectiondate")}` : "",
          pick(o, "rejectionreason") ? `Reason: ${pick(o, "rejectionreason")}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  const noteParts = [
    asNotes(pick(o, "notes")),
    rejection,
    pick(o, "client") ? `Client: ${pick(o, "client")}` : "",
    pick(o, "project") || pick(o, "program")
      ? `Project: ${pick(o, "project") || pick(o, "program")}`
      : "",
    pick(o, "security") ? `Security: ${pick(o, "security")}` : "",
    pick(o, "travel") ? `Travel: ${pick(o, "travel")}` : "",
    pick(o, "userinterest") ? `Interest: ${pick(o, "userinterest")}` : "",
    pick(o, "jobid") ? `Job ID: ${pick(o, "jobid")}` : "",
    asStringList(pick(o, "benefits")).length
      ? `Benefits: ${asStringList(pick(o, "benefits")).join(", ")}`
      : "",
    asStringList(pick(o, "technology")).length
      ? `Tech: ${asStringList(pick(o, "technology")).join(", ")}`
      : "",
  ];

  // Employment type (FT/PT/1099) separate from work arrangement (remote/hybrid/onsite)
  const employmentBase = String(pick(o, "employmenttype", "jobtype") ?? "").trim();
  const workTypeRaw = pick(
    o,
    "worktype",
    "workarrangement",
    "workarrangementtype",
    "arrangement",
  );
  const workType =
    normalizeWorkType(workTypeRaw) || normalizeWorkType(employmentBase);
  // If employment_type was only "Remote"/"Hybrid", don't repeat it as the employment label
  const employmentLabel = normalizeWorkType(employmentBase) ? "" : employmentBase;
  const employmentType = [
    employmentLabel,
    workType ? workType.charAt(0).toUpperCase() + workType.slice(1) : "",
    pick(o, "hoursperweek") ? `${pick(o, "hoursperweek")} hrs/wk` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const location = composeLocation({
    location: pick(o, "location", "joblocation", "office"),
    city: pick(o, "locationcity", "city"),
    state: pick(o, "locationstate", "state", "region", "locationregion"),
    country: pick(o, "locationcountry", "country"),
    workType: workType || workTypeRaw,
  });

  return {
    id: String(pick(o, "id") ?? crypto.randomUUID()),
    title: title || "Untitled role",
    company: company || "Unknown company",
    shortName,
    location,
    dateApplied,
    dateDiscussed,
    datePrecision,
    rate: salary.rateLabel,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryPeriod: salary.period,
    annualMid: salary.annualMid,
    status: mapStatus(statusRaw),
    statusRaw,
    description: String(pick(o, "description", "department", "project", "program") ?? "").trim(),
    source: String(pick(o, "source", "applicationmethod", "applicationsource") ?? "").trim(),
    tags: [...new Set([...strongMatches.slice(0, 8), ...asStringList(pick(o, "tags"))])],
    strongMatches,
    gaps,
    matchScore: parseMatchScore(pick(o, "fitscore", "matchscoreestimate", "matchscore")),
    matchLevel: String(pick(o, "fit", "matchlevel") ?? "").trim(),
    userInterest: String(pick(o, "userinterest") ?? "").trim(),
    notes: noteParts.filter(Boolean).join("\n"),
    url: String(pick(o, "url", "joburl", "link", "sourceurl") ?? "").trim(),
    department: String(pick(o, "department") ?? "").trim(),
    employmentType,
    interviewDate,
    interviewNotes,
    isTarget,
    updatedAt: String(pick(o, "updatedat") ?? pick(o, "updated") ?? new Date().toISOString()),
  };
}

export function parseTrackerPayload(payload: unknown): {
  jobs: JobApplication[];
  meta: Partial<TrackerMeta> | null;
} {
  const meta = extractTrackerMeta(payload);
  const targets = (meta?.targets ?? []).map((t) => t.company);
  const jobs = extractJobRecords(payload)
    .map((row) => normalizeJob(row, targets))
    .filter((j): j is JobApplication => Boolean(j))
    .map((j) => ({ ...j, updatedAt: new Date().toISOString() }));
  return { jobs, meta };
}
