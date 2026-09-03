import { generateText, Output } from "ai";
import { z } from "zod";
import {
  composeLocation,
  normalizeWorkType,
  type JobApplication,
} from "./types";
import {
  computeAnnualMid,
  formatRateLabel,
  scrapeBlockHint,
  stripHtmlToText,
  trimDescription,
  type IngestFields,
  type WorkType,
} from "./ingest-shared";

export type { IngestFields, RequiredIngestKey, WorkType } from "./ingest-shared";
export {
  DESCRIPTION_MAX,
  MISSING_PROMPTS,
  REQUIRED_INGEST_KEYS,
  computeAnnualMid,
  formatRateLabel,
  looksLikeUrl,
  missingRequiredFields,
  scrapeBlockHint,
  stripHtmlToText,
  trimDescription,
} from "./ingest-shared";

export type IngestResult = {
  fields: IngestFields;
  mode: "ai" | "heuristic";
  fetchWarning?: string;
};

const extractSchema = z.object({
  company: z.string().nullable().describe("Employer / company name only"),
  title: z.string().nullable().describe("Job / role title only"),
  location: z
    .string()
    .nullable()
    .describe("City and state/region when present (e.g. Austin, TX). Do not put Remote/Hybrid alone here if a city exists."),
  workType: z
    .enum(["remote", "hybrid", "onsite", ""])
    .nullable()
    .describe("Work arrangement: remote, hybrid, onsite, or empty if unknown"),
  url: z.string().nullable().describe("Canonical job posting URL if present in the text"),
  description: z
    .string()
    .nullable()
    .describe(
      "Cleaned full job description: responsibilities, requirements, qualifications, benefits. Strip nav, cookie banners, apply buttons, and boilerplate. Keep substantive posting text.",
    ),
  rate: z.string().nullable().describe("Human-readable pay string if present, e.g. $120k–$140k or $45–$55/hr"),
  salaryMin: z.number().nullable().describe("Lower bound numeric salary/wage if clear (yearly dollars or hourly dollars)"),
  salaryMax: z.number().nullable().describe("Upper bound numeric salary/wage if clear"),
  salaryPeriod: z
    .enum(["annual", "hourly", "daily", ""])
    .nullable()
    .describe("Pay period: annual for yearly salary, hourly for $/hr, daily for day rate"),
  employmentType: z
    .string()
    .nullable()
    .describe(
      "Hours / employment classification only — e.g. Full-time, Part-time, Contract, 20 hrs/week. Do NOT put Remote/Hybrid here.",
    ),
});

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function looksLikeBlockedPage(text: string): boolean {
  const t = text.slice(0, 2500).toLowerCase();
  if (t.length < 80) return true;
  const signals = [
    "enable javascript",
    "please enable cookies",
    "captcha",
    "unusual traffic",
    "sign in to continue",
    "log in to linkedin",
    "join linkedin",
    "access denied",
    "bot detection",
    "cf-browser-verification",
    "verify you are a human",
  ];
  return signals.some((s) => t.includes(s));
}

export async function fetchUrlAsText(url: string): Promise<{ text: string; warning?: string }> {
  const blockHint = scrapeBlockHint(url);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        text: "",
        warning:
          blockHint ||
          `Could not fetch URL (${res.status}). Paste the posting text instead.`,
      };
    }

    const ctype = res.headers.get("content-type") || "";
    const body = await res.text();
    if (!body.trim()) {
      return {
        text: "",
        warning: blockHint || "URL returned empty content. Paste the posting text instead.",
      };
    }

    let text: string;
    if (ctype.includes("text/plain") || ctype.includes("application/json")) {
      text = trimDescription(body);
    } else {
      text = trimDescription(stripHtmlToText(body));
    }

    if (!text || looksLikeBlockedPage(text)) {
      return {
        text: "",
        warning:
          blockHint ||
          "Fetch returned a login/challenge page or almost no content. Paste the posting text instead.",
      };
    }

    return {
      text,
      warning: blockHint && text.length < 600 ? blockHint : undefined,
    };
  } catch {
    return {
      text: "",
      warning:
        blockHint || "Fetch blocked or timed out. Paste the posting text instead.",
    };
  }
}

function emptyFields(partial: Partial<IngestFields> = {}): IngestFields {
  return {
    company: "",
    title: "",
    location: "",
    workType: "",
    url: "",
    description: "",
    rate: "",
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: "",
    employmentType: "",
    source: "",
    dateApplied: "",
    dateDiscussed: "",
    ...partial,
  };
}

function moneyFromMatch(raw: string): number | null {
  const cleaned = raw.replace(/[,$]/g, "").toLowerCase();
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  if (/k\b/i.test(raw) || /k$/i.test(cleaned)) return Math.round(n * 1000);
  return Math.round(n);
}

function detectWorkType(text: string): WorkType {
  return normalizeWorkType(text) || "";
}

function detectEmploymentType(text: string): string {
  const hours = text.match(
    /\b(\d{1,2})\s*(?:hours?|hrs?)\s*(?:per|\/|\s)*\s*(?:week|wk)\b/i,
  );
  if (hours) return `${hours[1]} hrs/week`;

  if (/\bfull[-\s]?time\b/i.test(text)) return "Full-time";
  if (/\bpart[-\s]?time\b/i.test(text)) return "Part-time";
  if (/\bcontract\b/i.test(text)) return "Contract";
  if (/\bintern(ship)?\b/i.test(text)) return "Internship";
  if (/\btemporary\b|\btemp\b/i.test(text)) return "Temporary";
  return "";
}

function detectSalary(text: string): {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: IngestFields["salaryPeriod"];
  rate: string;
} {
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  let salaryPeriod: IngestFields["salaryPeriod"] = "";
  let rate = "";

  // Hourly: $45/hr, $45 – $55 per hour, $45.00-$55.00/hour
  const hourly =
    text.match(
      /\$\s?([\d,]+(?:\.\d+)?)\s*(?:[-–—to]+\s*\$?\s?([\d,]+(?:\.\d+)?)\s*)?(?:\/\s*hr|\/\s*hour|per\s*hour|an\s*hour|hourly)\b/i,
    ) ||
    text.match(
      /\$\s?([\d,]+(?:\.\d+)?)\s*[-–—to]+\s*\$?\s?([\d,]+(?:\.\d+)?)\s*(?:\/\s*hr|\/\s*hour|per\s*hour|hourly)\b/i,
    );

  if (hourly) {
    salaryMin = moneyFromMatch(hourly[1]);
    salaryMax = hourly[2] ? moneyFromMatch(hourly[2]) : salaryMin;
    salaryPeriod = "hourly";
    rate = formatRateLabel(salaryMin, salaryMax, "hourly") || hourly[0].replace(/\s+/g, " ").trim();
    return { salaryMin, salaryMax, salaryPeriod, rate };
  }

  // Daily
  const daily = text.match(
    /\$\s?([\d,]+(?:\.\d+)?)\s*(?:[-–—to]+\s*\$?\s?([\d,]+(?:\.\d+)?)\s*)?(?:\/\s*day|per\s*day|daily)\b/i,
  );
  if (daily) {
    salaryMin = moneyFromMatch(daily[1]);
    salaryMax = daily[2] ? moneyFromMatch(daily[2]) : salaryMin;
    salaryPeriod = "daily";
    rate = formatRateLabel(salaryMin, salaryMax, "daily") || daily[0].replace(/\s+/g, " ").trim();
    return { salaryMin, salaryMax, salaryPeriod, rate };
  }

  // Annual range: $120,000 – $140,000 or $120k-$140k or $120,000 to $140,000 per year
  const annual =
    text.match(
      /\$\s?([\d,]+(?:\.\d+)?)\s*k?\s*[-–—to]+\s*\$?\s?([\d,]+(?:\.\d+)?)\s*k?(?:\s*(?:per\s*year|\/\s*yr|\/\s*year|annually|a\s*year))?/i,
    ) ||
    text.match(
      /\$\s?([\d,]+(?:\.\d+)?)\s*k(?:\s*(?:per\s*year|\/\s*yr|\/\s*year|annually))?/i,
    );

  if (annual) {
    const usedK = /k/i.test(annual[0]);
    salaryMin = moneyFromMatch(annual[1] + (usedK ? "k" : ""));
    salaryMax = annual[2]
      ? moneyFromMatch(annual[2] + (usedK ? "k" : ""))
      : salaryMin;
    // Heuristic: small numbers without k are likely hourly mis-catches — skip if < 1000 without year cue
    const yearCue = /year|annually|\/\s*yr|salary|compensation/i.test(
      text.slice(Math.max(0, (annual.index ?? 0) - 40), (annual.index ?? 0) + annual[0].length + 40),
    );
    if (salaryMin != null && salaryMin < 1000 && !usedK && !yearCue) {
      // treat as hourly single/range without /hr label
      salaryPeriod = "hourly";
    } else {
      salaryPeriod = "annual";
    }
    rate =
      formatRateLabel(salaryMin, salaryMax, salaryPeriod) ||
      annual[0].replace(/\s+/g, " ").trim();
    return { salaryMin, salaryMax, salaryPeriod, rate };
  }

  return { salaryMin, salaryMax, salaryPeriod, rate };
}

function placeFromText(text: string, workType: WorkType): string {
  const locLine = text
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => /^(location|office|based\s+in|work\s*location)\s*[:\-–]/i.test(l));
  if (locLine) {
    const place = locLine
      .replace(/^(location|office|based\s+in|work\s*location)\s*[:\-–]\s*/i, "")
      .trim();
    // Strip trailing remote/hybrid tags from place when we have workType
    return place
      .replace(/\s*[·|,/]\s*(remote|hybrid|on[-\s]?site).*$/i, "")
      .replace(/\b(remote|hybrid|on[-\s]?site)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || place;
  }

  const cityState = text.match(
    /\b([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)?),\s*([A-Z]{2})\b/,
  );
  if (cityState) return `${cityState[1]}, ${cityState[2]}`;

  if (workType === "remote") return "Remote";
  if (workType === "hybrid") return "Hybrid";
  if (workType === "onsite") return "Onsite";
  return "";
}

/** Cheap regex/heuristic extraction when AI Gateway is unavailable. */
export function heuristicExtract(text: string, knownUrl = ""): IngestFields {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let title = "";
  let company = "";

  const titleLine =
    lines.find((l) => /^(job\s*title|position|role)\s*[:\-–]/i.test(l)) ||
    lines.find((l) => l.length > 4 && l.length < 120 && !/^https?:/i.test(l));
  if (titleLine) {
    title = titleLine.replace(/^(job\s*title|position|role)\s*[:\-–]\s*/i, "").trim();
  }

  const companyLine = lines.find((l) =>
    /^(company|employer|organization)\s*[:\-–]/i.test(l),
  );
  if (companyLine) {
    company = companyLine
      .replace(/^(company|employer|organization)\s*[:\-–]\s*/i, "")
      .trim();
  } else {
    const at = text.match(/\bat\s+([A-Z][\w&.\-]*(?:\s+[A-Z][\w&.\-]*){0,4})\b/);
    if (at?.[1] && at[1].length < 60) company = at[1].trim();
  }

  const workType = detectWorkType(text);
  const location = composeLocation({
    location: placeFromText(text, workType),
    workType,
  });
  const employmentType = detectEmploymentType(text);
  const { salaryMin, salaryMax, salaryPeriod, rate } = detectSalary(text);

  let url = knownUrl;
  if (!url) {
    const found = text.match(/https?:\/\/[^\s"'<>]+/i);
    if (found) url = found[0].replace(/[),.;]+$/, "");
  }

  let source = "";
  try {
    if (url) source = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    source = "";
  }

  return emptyFields({
    company,
    title,
    location,
    workType,
    url,
    description: trimDescription(text),
    rate,
    salaryMin,
    salaryMax,
    salaryPeriod,
    employmentType,
    source,
  });
}

export async function aiExtract(text: string, knownUrl = ""): Promise<IngestFields | null> {
  if (!aiConfigured()) return null;
  try {
    const { output } = await generateText({
      model: process.env.PIPELINE_INGEST_MODEL || "openai/gpt-4.1-nano",
      output: Output.object({ schema: extractSchema }),
      prompt: `Extract structured fields from this job posting.
Rules:
- Only use facts present in the text. Use null/empty when unknown — never invent dates, status, or pay.
- description: cleaned full posting body (responsibilities + requirements). No nav/cookie/apply chrome.
- workType: remote | hybrid | onsite | "" — from wording like Remote, Hybrid, On-site / Onsite / In-office.
- location: city/state (or country) when present. If only remote with no city, use "Remote".
- employmentType: hours/classification only (Full-time, Part-time, Contract, "20 hrs/week"). Not remote/hybrid.
- salaryPeriod: annual for yearly salary ranges; hourly for $/hr; daily for day rates.
- salaryMin/salaryMax: numeric (120000 not "$120k"; 45 for $45/hr).
- If a posting URL is known separately, prefer it: ${knownUrl || "(none)"}.

JOB POSTING TEXT:
${text.slice(0, 12_000)}`,
    });

    if (!output) return null;

    const workType = (normalizeWorkType(output.workType) || "") as WorkType;
    const place = (output.location || "").trim();
    const location =
      composeLocation({ location: place, workType }) || place;

    const period = output.salaryPeriod || "";
    const salaryPeriod: IngestFields["salaryPeriod"] =
      period === "annual" || period === "hourly" || period === "daily" ? period : "";

    const salaryMin = output.salaryMin ?? null;
    const salaryMax = output.salaryMax ?? null;
    let rate = (output.rate || "").trim();
    if (!rate && (salaryMin != null || salaryMax != null)) {
      rate = formatRateLabel(salaryMin, salaryMax, salaryPeriod);
    }

    let url = (output.url || "").trim() || knownUrl;
    if (url && !/^https?:\/\//i.test(url)) url = knownUrl;

    let source = "";
    try {
      if (url) source = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      source = "";
    }

    const aiDesc = (output.description || "").trim();
    const description = trimDescription(
      aiDesc.length >= 80 ? aiDesc : text,
    );

    return emptyFields({
      company: (output.company || "").trim(),
      title: (output.title || "").trim(),
      location,
      workType,
      url,
      description,
      rate,
      salaryMin,
      salaryMax,
      salaryPeriod,
      employmentType: (output.employmentType || "").trim(),
      source,
    });
  } catch {
    return null;
  }
}

/** Merge AI + heuristic: prefer AI when present, fill gaps from heuristic. */
export function mergeIngestFields(ai: IngestFields, heuristic: IngestFields): IngestFields {
  const salaryMin = ai.salaryMin ?? heuristic.salaryMin;
  const salaryMax = ai.salaryMax ?? heuristic.salaryMax;
  const salaryPeriod = ai.salaryPeriod || heuristic.salaryPeriod;
  let rate = ai.rate || heuristic.rate;
  if (!rate && (salaryMin != null || salaryMax != null)) {
    rate = formatRateLabel(salaryMin, salaryMax, salaryPeriod);
  }

  const workType = (ai.workType || heuristic.workType) as WorkType;
  const place = ai.location || heuristic.location;
  const location = composeLocation({ location: place, workType }) || place;

  const description =
    ai.description.length >= 80 ? ai.description : heuristic.description || ai.description;

  return emptyFields({
    company: ai.company || heuristic.company,
    title: ai.title || heuristic.title,
    location,
    workType,
    url: ai.url || heuristic.url,
    description,
    rate,
    salaryMin,
    salaryMax,
    salaryPeriod,
    employmentType: ai.employmentType || heuristic.employmentType,
    source: ai.source || heuristic.source,
  });
}

export function fieldsToPartialJob(fields: IngestFields): Partial<JobApplication> {
  const workType = fields.workType || normalizeWorkType(fields.location) || "";
  const location =
    composeLocation({ location: fields.location, workType }) || fields.location;
  const salaryPeriod = fields.salaryPeriod;
  const rate =
    fields.rate ||
    formatRateLabel(fields.salaryMin, fields.salaryMax, salaryPeriod);

  return {
    company: fields.company,
    title: fields.title,
    location,
    url: fields.url,
    description: fields.description,
    rate,
    salaryMin: fields.salaryMin,
    salaryMax: fields.salaryMax,
    salaryPeriod,
    annualMid: computeAnnualMid(fields.salaryMin, fields.salaryMax, salaryPeriod),
    employmentType: fields.employmentType,
    source: fields.source,
    status: "researching",
    dateApplied: fields.dateApplied || "",
    dateDiscussed: fields.dateDiscussed || "",
    datePrecision: fields.dateApplied ? "exact" : "unknown",
  };
}
