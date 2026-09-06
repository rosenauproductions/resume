import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { readFileSync } from "fs";
import path from "path";
import { dbConfigured, getDb } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = readFileSync(
  path.join(process.cwd(), "system-prompt.md"),
  "utf-8",
);

function aiConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function textFromUiMessage(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
    .trim();
}

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return Response.json(
      { error: "Chat is not configured (AI Gateway missing)." },
      { status: 503 },
    );
  }

  let body: { messages?: UIMessage[]; sessionId?: string };
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

  const modelMessages = await convertToModelMessages(messages);
  const lastUserText = textFromUiMessage(
    [...messages].reverse().find((m) => m.role === "user"),
  );

  const result = streamText({
    model: process.env.RESUME_CHAT_MODEL || "google/gemini-2.5-flash",
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    maxOutputTokens: 500,
    onFinish: async ({ text }) => {
      if (!dbConfigured() || !lastUserText) return;
      try {
        await getDb().insert(chatMessages).values({
          sessionId,
          visitorMessage: lastUserText.slice(0, 4000),
          botReply: (text || "").slice(0, 8000),
        });
      } catch (err) {
        console.error("Failed to log chat message:", err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
