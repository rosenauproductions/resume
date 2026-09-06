import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { readFileSync } from "fs";
import path from "path";
import { dbConfigured } from "@/lib/db";
import { insertChatTurn } from "@/lib/db/chat";
import {
  findCachedAnswer,
  recordCacheHit,
  upsertCachedAnswer,
} from "@/lib/chat/cache";

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

  let body: { messages?: UIMessage[]; sessionId?: string; deviceId?: string };
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

  const lastUserText = textFromUiMessage(
    [...messages].reverse().find((m) => m.role === "user"),
  );
  const userTurns = countUserMessages(messages);
  // Fuzzy reuse only on the first question — follow-ups need conversation context.
  const allowFuzzy = userTurns <= 1;

  if (dbConfigured() && lastUserText) {
    try {
      const hit = await findCachedAnswer(lastUserText, { allowFuzzy });
      // Exact matches are safe any turn; fuzzy only on first turn (allowFuzzy gate above).
      if (hit && (hit.match === "exact" || allowFuzzy)) {
        const answer = hit.answer.trim();
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
    } catch (err) {
      console.error("chat cache lookup failed:", err);
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: process.env.RESUME_CHAT_MODEL || "google/gemini-2.5-flash",
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    maxOutputTokens: 500,
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
      if (reply) {
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
