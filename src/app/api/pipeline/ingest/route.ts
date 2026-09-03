import { NextResponse } from "next/server";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";
import {
  aiConfigured,
  aiExtract,
  fetchUrlAsText,
  fieldsToPartialJob,
  heuristicExtract,
  looksLikeUrl,
  mergeIngestFields,
  missingRequiredFields,
  scrapeBlockHint,
  trimDescription,
  type IngestFields,
} from "@/lib/jobs/ingest";

export const maxDuration = 60;

function emptyIngest(url = ""): IngestFields {
  return {
    company: "",
    title: "",
    location: "",
    workType: "",
    url,
    description: "",
    rate: "",
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: "",
    employmentType: "",
    source: "",
    dateApplied: "",
    dateDiscussed: "",
  };
}

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
    const earlyHint = scrapeBlockHint(input);
    const fetched = await fetchUrlAsText(input);
    if (fetched.text) {
      text = fetched.text;
      fetchWarning = fetched.warning;
    } else {
      text = "";
      fetchWarning =
        fetched.warning ||
        earlyHint ||
        "Could not fetch URL. Paste the posting text instead.";
    }
  }

  if (!text.trim()) {
    const fields = emptyIngest(knownUrl);
    return NextResponse.json({
      job: fieldsToPartialJob(fields),
      fields,
      mode: "heuristic" as const,
      aiAvailable: aiConfigured(),
      missing: missingRequiredFields(fields),
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
      fields = mergeIngestFields(ai, fields);
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
