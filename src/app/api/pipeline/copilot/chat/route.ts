import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { dbConfigured, getDb } from "@/lib/db";
import { createCopilotItem, listCopilotItems } from "@/lib/db/copilot";
import { applications } from "@/lib/db/schema";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function aiConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL,
  );
}

async function buildContext(): Promise<string> {
  if (!dbConfigured()) return "No database configured — no pipeline/feed context available.";

  const [flags, recentRequests, recentJobs] = await Promise.all([
    listCopilotItems({ kind: "flag", limit: 60 }),
    listCopilotItems({ kind: "request", limit: 30 }),
    getDb().select().from(applications).orderBy(desc(applications.updatedAt)).limit(30),
  ]);

  const flagLines = flags
    .map(
      (f) =>
        `- [${f.status}] (${f.category}) ${f.title}${f.body ? " — " + f.body.slice(0, 200) : ""}${
          f.sourceLink ? ` (source: ${f.sourceLink})` : ""
        } [id:${f.id}]`,
    )
    .join("\n");

  const requestLines = recentRequests
    .map(
      (r) =>
        `- [${r.status}] [${r.requestType || "general"}] ${r.title} — ${r.body}${
          r.resultNote ? ` (bot said: ${r.resultNote})` : ""
        } [id:${r.id}]`,
    )
    .join("\n");

  const jobLines = recentJobs
    .map((j) => `- ${j.company} — ${j.title} — status: ${j.status}`)
    .join("\n");

  return [
    "Recent items the hourly email bot flagged (most recent first, up to 60):",
    flagLines || "(none)",
    "",
    "Requests you've queued for the bot (pending = will run next hourly fire; done/blocked = already resolved, with the bot's note):",
    requestLines || "(none)",
    "",
    "Recent job pipeline entries (most recently updated, up to 30):",
    jobLines || "(none)",
  ].join("\n");
}

const SYSTEM_PROMPT = `You are Chris Rosenau's personal copilot on his resume/pipeline site. You have access to a feed of things the hourly email bot noticed (from his wife Trisha, job search, Boy Scouts, events, and everything else) and his job-application pipeline. Answer his questions plainly and briefly using that context — don't pad with filler.

You have one tool, queueRequest, which queues an instruction for the hourly bot to act on during its next run (it fires roughly hourly and has its own Gmail, Calendar, Drive, and pipeline access).

Rules for queueRequest:
- Only call it when Chris has clearly asked for something to be done, or has explicitly said yes/confirmed after you proposed it. Never call it just because a flagged item looks calendar-worthy — propose it in plain text first and wait for him to confirm, unless he already gave a clear standing instruction in this conversation.
- Use requestType "calendar_add" when he wants something added to his Google Calendar — fill in the calendarEvent fields as best you can from context (ask him for anything essential that's missing, like a date, before queuing).
- Use requestType "general" for anything else he wants the bot to do next run (e.g. "reply to Trisha and say yes", "double check the Acme status").
- After queuing, tell him plainly that it's queued and will run within about an hour (the bot's cadence) — don't promise it happens immediately.
- Never invent flagged items or pipeline data that isn't in your context — say you don't see it if it's not there.`;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return Response.json({ error: "Copilot chat is not configured (AI Gateway missing)." }, { status: 503 });
  }

  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);

  let body: { messages?: UIMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const context = await buildContext();
  const modelMessages = await convertToModelMessages(messages);

  const tools = {
    queueRequest: tool({
      description:
        "Queue an instruction for the hourly email bot's next run — either adding something to Google Calendar, or a general instruction.",
      inputSchema: z.object({
        requestType: z.enum(["calendar_add", "general"]),
        title: z.string().min(1).describe("Short headline for this request"),
        instructions: z.string().min(1).describe("What the bot should do, in plain English"),
        calendarEvent: z
          .object({
            title: z.string(),
            date: z.string().describe("YYYY-MM-DD"),
            time: z.string().describe('HH:MM 24-hour, or "" for all-day'),
            location: z.string(),
            notes: z.string(),
          })
          .optional()
          .describe("Required when requestType is calendar_add"),
      }),
      execute: async (input) => {
        try {
          const item = await createCopilotItem({
            kind: "request",
            category: "system",
            title: input.title,
            body: input.instructions,
            requestType: input.requestType,
            calendarEvent: input.requestType === "calendar_add" ? input.calendarEvent ?? null : null,
            createdBy: "copilot",
          });
          return { ok: true as const, id: item.id, message: "Queued for the bot's next run." };
        } catch (error) {
          return {
            ok: false as const,
            error: error instanceof Error ? error.message : "Failed to queue request",
          };
        }
      },
    }),
  };

  const result = streamText({
    model: process.env.RESUME_CHAT_MODEL || "google/gemini-2.5-flash",
    system: `${SYSTEM_PROMPT}\n\n---\nCurrent context:\n${context}`,
    messages: modelMessages,
    maxOutputTokens: 700,
    tools,
    stopWhen: stepCountIs(4),
  });

  return result.toUIMessageStreamResponse();
}
