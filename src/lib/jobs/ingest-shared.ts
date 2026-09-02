export const DESCRIPTION_MAX = 8000;

export type IngestFields = {
  company: string;
  title: string;
  location: string;
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
  fields: Pick<IngestFields, RequiredIngestKey>,
): RequiredIngestKey[] {
  return REQUIRED_INGEST_KEYS.filter((key) => !fields[key]?.trim());
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

export function stripHtmlToText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article|header|footer)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}
