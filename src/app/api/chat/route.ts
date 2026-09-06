import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";
import { dbConfigured } from "@/lib/db";
import { insertChatTurn } from "@/lib/db/chat";
import {
  findCachedAnswer,
  isContactIntent,
  purgeContactDumpCache,
  recordCacheHit,
  upsertCachedAnswer,
} from "@/lib/chat/cache";
import { saveVisitorIdentification } from "@/lib/db/visitor-identify";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = readFileSync(
  path.join(process.cwd(), "system-prompt.md"),
  "utf-8",
);

function aiConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL,
  );
}

function textFromUiMessage(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
    .trim();
}

function countUserMessages(messages: UIMessage[]) {
  return messages.filter((m) => m.role === "user").length;
}

function cachedAnswerResponse(answer: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "start-step" });
      writer.write({ type: "text-start", id: "0" });
      writer.write({ type: "text-delta", id: "0", delta: answer });
      writer.write({ type: "text-end", id: "0" });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return Response.json(
      { error: "Chat is not configured (AI Gateway missing)." },
      { status: 503 },
    );
  }

  let body: {
    messages?: UIMessage[];
    sessionId?: string;
    deviceId?: string;
    visitId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim().slice(0, 128)
      : "anonymous";
  const deviceId =
    typeof body.deviceId === "string" && body.deviceId.trim()
      ? body.deviceId.trim().slice(0, 128)
      : "";
  const visitId =
    typeof body.visitId === "string" && body.visitId.trim()
      ? body.visitId.trim()
      : null;

  const lastUserText = textFromUiMessage(
    [...messages].reverse().find((m) => m.role === "user"),
  );
  const userTurns = countUserMessages(messages);
  const allowFuzzy = userTurns <= 1;
  const contactIntent = lastUserText ? isContactIntent(lastUserText) : false;

  if (dbConfigured() && contactIntent) {
    try {
      await purgeContactDumpCache();
    } catch (err) {
      console.error("contact cache purge failed:", err);
    }
  }

  if (dbConfigured() && lastUserText && !contactIntent) {
    try {
      const hit = await findCachedAnswer(lastUserText, { allowFuzzy });
      if (hit && (hit.match === "exact" || allowFuzzy)) {
        const answer = hit.answer.trim();
        // Never reuse old "here's Chris's email/phone" dumps
        const isContactDump =
          /rosenauproductions@gmail\.com/i.test(answer) &&
          (/945-217-2211/.test(answer) || /linkedin\.com\/in\/christopherrosenau/i.test(answer));
        if (!isContactDump) {
          await recordCacheHit(hit);
          await insertChatTurn({
            sessionId,
            deviceId,
            visitorMessage: lastUserText,
            botReply: answer,
            fromCache: true,
          });
          return cachedAnswerResponse(answer);
        }
      }
    } catch (err) {
      console.error("chat cache lookup failed:", err);
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const tools =
    dbConfigured() && deviceId
      ? {
          saveVisitorLead: tool({
            description:
              "Save the visitor's contact details for Chris (name, email, optional company/phone/message). Use when they want Chris to contact them or shared who they are.",
            inputSchema: z.object({
              name: z.string().min(1).describe("Visitor's name"),
              email: z.string().email().describe("Visitor's email"),
              phone: z.string().optional().describe("Optional phone"),
              company: z
                .string()
                .optional()
                .describe("Company or organization; optional if requesting contact"),
              title: z.string().optional().describe("Their role/title if shared"),
              message: z
                .string()
                .optional()
                .describe("Short note about what they want"),
              requestContact: z
                .boolean()
                .describe("True if they want Chris to follow up / contact them"),
            }),
            execute: async (input) => {
              try {
                const result = await saveVisitorIdentification({
                  deviceId,
                  visitId,
                  freeText: input.message || "",
                  lead: {
                    name: input.name,
                    email: input.email,
                    phone: input.phone || "",
                    company: input.company || "",
                    title: input.title || "",
                    message: input.message || "",
                    requestContact: Boolean(input.requestContact),
                  },
                });
                return {
                  ok: true as const,
                  createdLead: result.createdLead,
                  message: input.requestContact
                    ? "Saved — Chris will see that they asked to be contacted."
                    : "Saved their info for Chris.",
                };
              } catch (error) {
                return {
                  ok: false as const,
                  error: error instanceof Error ? error.message : "Save failed",
                };
              }
            },
          }),
        }
      : undefined;

  const result = streamText({
    model: process.env.RESUME_CHAT_MODEL || "google/gemini-2.5-flash",
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    maxOutputTokens: 500,
    tools,
    stopWhen: tools ? stepCountIs(3) : undefined,
    onFinish: async ({ text }) => {
      if (!dbConfigured() || !lastUserText) return;
      const reply = (text || "").trim();
      try {
        await insertChatTurn({
          sessionId,
          deviceId,
          visitorMessage: lastUserText,
          botReply: reply,
          fromCache: false,
        });
      } catch (err) {
        console.error("Failed to log chat message:", err);
      }
      if (reply && !contactIntent && !isContactIntent(reply)) {
        try {
          await upsertCachedAnswer({ question: lastUserText, answer: reply });
        } catch (err) {
          console.error("Failed to upsert chat cache:", err);
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
