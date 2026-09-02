import { generateText, Output } from "ai";
import { z } from "zod";
import type { JobApplication } from "./types";
import {
  stripHtmlToText,
  trimDescription,
  type IngestFields,
} from "./ingest-shared";

export type { IngestFields, RequiredIngestKey } from "./ingest-shared";
export {
  DESCRIPTION_MAX,
  MISSING_PROMPTS,
  REQUIRED_INGEST_KEYS,
  looksLikeUrl,
  missingRequiredFields,
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
  location: z.string().nullable().describe("City, region, Remote, Hybrid, or On-site"),
  url: z.string().nullable().describe("Canonical job posting URL if present in the text"),
  rate: z.string().nullable().describe("Human-readable pay string if present, e.g. $120k–$140k"),
  salaryMin: z.number().nullable().describe("Lower bound numeric salary if clear"),
  salaryMax: z.number().nullable().describe("Upper bound numeric salary if clear"),
  salaryPeriod: z
    .enum(["annual", "hourly", "daily", ""])
    .nullable()
    .describe("Pay period if known"),
  employmentType: z
    .string()
    .nullable()
    .describe("e.g. Full-time, Part-time, Contract, Remote"),
});

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export async function fetchUrlAsText(url: string): Promise<{ text: string; warning?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ResumePipelineBot/1.0; +https://github.com/christopherrosenau/resume)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        text: "",
        warning: `Could not fetch URL (${res.status}). Paste the posting text instead.`,
      };
    }

    const ctype = res.headers.get("content-type") || "";
    const body = await res.text();
    if (!body.trim()) {
      return { text: "", warning: "URL returned empty content. Paste the posting text instead." };
    }
    if (ctype.includes("text/plain")) {
      return { text: trimDescription(body) };
    }
    return { text: trimDescription(stripHtmlToText(body)) };
  } catch {
    return {
      text: "",
      warning: "Fetch blocked or timed out. Paste the posting text instead.",
    };
  }
}

function emptyFields(partial: Partial<IngestFields> = {}): IngestFields {
  return {
    company: "",
    title: "",
    location: "",
    url: "",
    description: "",
    rate: "",
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: "",
    employmentType: "",
    source: "",
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

/** Cheap regex/heuristic extraction when AI Gateway is unavailable. */
export function heuristicExtract(text: string, knownUrl = ""): IngestFields {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let title = "";
  let company = "";
  let location = "";
  let employmentType = "";
  let rate = "";
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  let salaryPeriod: IngestFields["salaryPeriod"] = "";

  const titleLine =
    lines.find((l) => /^(job\s*title|position|role)\s*[:\-–]/i.test(l)) ||
    lines.find((l) => l.length > 4 && l.length < 120 && !/^https?:/i.test(l));
  if (titleLine) {
    title = titleLine.replace(/^(job\s*title|position|role)\s*[:\-–]\s*/i, "").trim();
  }

  const companyLine = lines.find((l) => /^(company|employer|organization)\s*[:\-–]/i.test(l));
  if (companyLine) {
    company = companyLine.replace(/^(company|employer|organization)\s*[:\-–]\s*/i, "").trim();
  } else {
    const at = text.match(/\bat\s+([A-Z][\w&.\-]*(?:\s+[A-Z][\w&.\-]*){0,4})\b/);
    if (at?.[1] && at[1].length < 60) company = at[1].trim();
  }

  const locLine = lines.find((l) => /^(location|office|based\s+in)\s*[:\-–]/i.test(l));
  if (locLine) {
    location = locLine.replace(/^(location|office|based\s+in)\s*[:\-–]\s*/i, "").trim();
  } else if (/\bremote\b/i.test(text)) {
    location = /hybrid/i.test(text) ? "Hybrid · Remote" : "Remote";
  } else {
    const cityState = text.match(
      /\b([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)?),\s*([A-Z]{2})\b/,
    );
    if (cityState) location = `${cityState[1]}, ${cityState[2]}`;
  }

  if (/\bfull[-\s]?time\b/i.test(text)) employmentType = "Full-time";
  else if (/\bpart[-\s]?time\b/i.test(text)) employmentType = "Part-time";
  else if (/\bcontract\b/i.test(text)) employmentType = "Contract";
  if (/\bremote\b/i.test(text) && employmentType) {
    employmentType = `${employmentType} · Remote`;
  }

  const salary =
    text.match(
      /\$\s?([\d,]+(?:\.\d+)?)\s*k?\s*[-–—to]+\s*\$?\s?([\d,]+(?:\.\d+)?)\s*k?/i,
    ) || text.match(/\$\s?([\d,]+(?:\.\d+)?)\s*k(?:\s*\/?\s*(?:yr|year|annually))?/i);

  if (salary) {
    salaryMin = moneyFromMatch(salary[1] + (/k/i.test(salary[0]) ? "k" : ""));
    salaryMax = salary[2]
      ? moneyFromMatch(salary[2] + (/k/i.test(salary[0]) ? "k" : ""))
      : salaryMin;
    salaryPeriod = /hour|\/hr|hourly/i.test(text)
      ? "hourly"
      : /day|daily|\/day/i.test(text)
        ? "daily"
        : "annual";
    rate = salary[0].replace(/\s+/g, " ").trim();
  }

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
      prompt: `Extract job posting fields from the text below.
Only use facts present in the text. Use null when unknown — never invent dates or status.
If a posting URL is known separately, prefer it: ${knownUrl || "(none)"}.

JOB POSTING TEXT:
${text.slice(0, 8000)}`,
    });

    if (!output) return null;

    const rate = (output.rate || "").trim();
    const period = output.salaryPeriod || "";
    const salaryPeriod: IngestFields["salaryPeriod"] =
      period === "annual" || period === "hourly" || period === "daily" ? period : "";

    let url = (output.url || "").trim() || knownUrl;
    if (url && !/^https?:\/\//i.test(url)) url = knownUrl;

    let source = "";
    try {
      if (url) source = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      source = "";
    }

    return emptyFields({
      company: (output.company || "").trim(),
      title: (output.title || "").trim(),
      location: (output.location || "").trim(),
      url,
      description: trimDescription(text),
      rate,
      salaryMin: output.salaryMin ?? null,
      salaryMax: output.salaryMax ?? null,
      salaryPeriod,
      employmentType: (output.employmentType || "").trim(),
      source,
    });
  } catch {
    return null;
  }
}

export function fieldsToPartialJob(fields: IngestFields): Partial<JobApplication> {
  return {
    company: fields.company,
    title: fields.title,
    location: fields.location,
    url: fields.url,
    description: fields.description,
    rate: fields.rate,
    salaryMin: fields.salaryMin,
    salaryMax: fields.salaryMax,
    salaryPeriod: fields.salaryPeriod,
    employmentType: fields.employmentType,
    source: fields.source,
    status: "researching",
    dateApplied: "",
    dateDiscussed: "",
    datePrecision: "unknown",
  };
}
