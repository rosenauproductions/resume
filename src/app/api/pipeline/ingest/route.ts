import { NextResponse } from "next/server";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";
import {
  aiConfigured,
  aiExtract,
  fetchUrlAsText,
  fieldsToPartialJob,
  heuristicExtract,
  looksLikeUrl,
  missingRequiredFields,
  trimDescription,
  type IngestFields,
} from "@/lib/jobs/ingest";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);

  let body: { input?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return NextResponse.json({ error: "Paste a job posting URL or text" }, { status: 400 });
  }

  let knownUrl = "";
  let text = input;
  let fetchWarning: string | undefined;

  if (looksLikeUrl(input)) {
    knownUrl = input;
    const fetched = await fetchUrlAsText(input);
    if (fetched.text) {
      text = fetched.text;
    } else {
      text = "";
      fetchWarning = fetched.warning || "Could not fetch URL.";
    }
  }

  if (!text.trim()) {
    return NextResponse.json({
      job: fieldsToPartialJob({
        company: "",
        title: "",
        location: "",
        url: knownUrl,
        description: "",
        rate: "",
        salaryMin: null,
        salaryMax: null,
        salaryPeriod: "",
        employmentType: "",
        source: "",
      }),
      fields: {
        company: "",
        title: "",
        location: "",
        url: knownUrl,
        description: "",
        rate: "",
        salaryMin: null,
        salaryMax: null,
        salaryPeriod: "",
        employmentType: "",
        source: "",
      } satisfies IngestFields,
      mode: "heuristic" as const,
      aiAvailable: aiConfigured(),
      missing: missingRequiredFields({
        company: "",
        title: "",
        location: "",
        url: knownUrl,
      }),
      fetchWarning: fetchWarning || "No posting text to parse.",
    });
  }

  text = trimDescription(text);

  let mode: "ai" | "heuristic" = "heuristic";
  let fields = heuristicExtract(text, knownUrl);

  if (aiConfigured()) {
    const ai = await aiExtract(text, knownUrl);
    if (ai) {
      mode = "ai";
      // Prefer AI fields when present; keep heuristic fallbacks for empties
      fields = {
        company: ai.company || fields.company,
        title: ai.title || fields.title,
        location: ai.location || fields.location,
        url: ai.url || fields.url || knownUrl,
        description: ai.description || fields.description,
        rate: ai.rate || fields.rate,
        salaryMin: ai.salaryMin ?? fields.salaryMin,
        salaryMax: ai.salaryMax ?? fields.salaryMax,
        salaryPeriod: ai.salaryPeriod || fields.salaryPeriod,
        employmentType: ai.employmentType || fields.employmentType,
        source: ai.source || fields.source,
      };
    }
  }

  if (knownUrl && !fields.url) fields.url = knownUrl;
  if (!fields.description) fields.description = text;

  return NextResponse.json({
    job: fieldsToPartialJob(fields),
    fields,
    mode,
    aiAvailable: aiConfigured(),
    missing: missingRequiredFields(fields),
    fetchWarning,
  });
}
