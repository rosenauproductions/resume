export const DESCRIPTION_MAX = 8000;

export type WorkType = "" | "remote" | "hybrid" | "onsite";

export type IngestFields = {
  company: string;
  title: string;
  location: string;
  workType: WorkType;
  url: string;
  description: string;
  rate: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: "annual" | "hourly" | "daily" | "";
  employmentType: string;
  source: string;
};

export const REQUIRED_INGEST_KEYS = ["company", "title", "location", "url"] as const;
export type RequiredIngestKey = (typeof REQUIRED_INGEST_KEYS)[number];

export const MISSING_PROMPTS: Record<RequiredIngestKey, string> = {
  company: "Company name?",
  title: "Role title?",
  location: "Location or Remote?",
  url: "Job posting URL?",
};

export function missingRequiredFields(
  fields: Pick<IngestFields, RequiredIngestKey> & { workType?: WorkType },
): RequiredIngestKey[] {
  return REQUIRED_INGEST_KEYS.filter((key) => {
    if (key === "location") {
      if (fields.location?.trim()) return false;
      const wt = fields.workType;
      if (wt === "remote" || wt === "hybrid" || wt === "onsite") return false;
      return true;
    }
    return !fields[key]?.trim();
  });
}

export function trimDescription(text: string): string {
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (cleaned.length <= DESCRIPTION_MAX) return cleaned;
  return `${cleaned.slice(0, DESCRIPTION_MAX).trimEnd()}\n…`;
}

export function looksLikeUrl(raw: string): boolean {
  const t = raw.trim();
  if (!/^https?:\/\/\S+$/i.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Hosts that commonly block server-side scrapes — paste text still works. */
export function scrapeBlockHint(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("linkedin.")) {
      return "LinkedIn usually blocks automated fetching. Paste the posting text instead (URL will still be saved).";
    }
    if (host.includes("myworkdayjobs.") || host.includes("workday.com")) {
      return "Workday career sites usually block scraping. Paste the posting text instead (URL will still be saved).";
    }
    if (host.includes("glassdoor.")) {
      return "Glassdoor often blocks automated fetching. Paste the posting text instead (URL will still be saved).";
    }
    if (host.includes("indeed.")) {
      return "Indeed sometimes blocks automated fetching. If extraction looks empty, paste the posting text.";
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    });
}

function stripChromeTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");
}

/** Prefer main / article / job-description chunks when present. */
function extractPreferredHtmlChunk(html: string): string {
  const patterns: RegExp[] = [
    /<(?:div|section|article)[^>]*(?:id|class|data-testid)=["'][^"']*(?:job[-_\s]?description|job[-_\s]?details|posting[-_\s]?description|jobAdDescription|job-desc|description__text|jobsearch-JobComponent-description)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|article)>/i,
    /<article\b[^>]*>[\s\S]*?<\/article>/i,
    /<main\b[^>]*>[\s\S]*?<\/main>/i,
    /<(?:div|section)[^>]*(?:id|class)=["'][^"']*(?:job[-_\s]?content|posting|vacancy|career[-_\s]?detail)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section)>/i,
  ];

  let best = "";
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[0] && m[0].length > best.length) best = m[0];
  }
  // Require a meaningful chunk so we don't pick tiny wrappers
  if (best.length >= 400) return best;
  return "";
}

function htmlChunkToText(html: string): string {
  let text = html
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article|header|footer|ul|ol)>/gi, "\n")
    .replace(/<(li|tr|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  text = decodeEntities(text);
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function stripHtmlToText(html: string): string {
  const cleaned = stripChromeTags(html);
  const preferred = extractPreferredHtmlChunk(cleaned);
  const source = preferred || cleaned;
  return htmlChunkToText(source);
}

export function formatRateLabel(
  min: number | null,
  max: number | null,
  period: IngestFields["salaryPeriod"],
): string {
  if (min == null && max == null) return "";
  const a = min ?? max!;
  const b = max ?? min!;
  if (period === "hourly") {
    return a === b ? `$${a}/hr` : `$${a}–$${b}/hr`;
  }
  if (period === "daily") {
    return a === b ? `$${a}/day` : `$${a}–$${b}/day`;
  }
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n}`;
  return a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`;
}

export function computeAnnualMid(
  min: number | null,
  max: number | null,
  period: IngestFields["salaryPeriod"],
): number | null {
  if (min == null && max == null) return null;
  const mid = ((min ?? max!) + (max ?? min!)) / 2;
  if (period === "hourly") return Math.round(mid * 40 * 52);
  if (period === "daily") return Math.round(mid * 12);
  return Math.round(mid);
}
