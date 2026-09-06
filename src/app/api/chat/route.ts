import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { readFileSync } from "fs";
import path from "path";
import { dbConfigured } from "@/lib/db";
import { insertChatTurn } from "@/lib/db/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = readFileSync(
  path.join(process.cwd(), "system-prompt.md"),
  "utf-8",
);

function aiConfigured() {
  // AI Gateway auth: API key, local OIDC from `vercel env pull`, or Vercel runtime
  // (production/preview inject OIDC per-request — not always as an env var).
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
        await insertChatTurn({
          sessionId,
          deviceId,
          visitorMessage: lastUserText,
          botReply: text || "",
        });
      } catch (err) {
        console.error("Failed to log chat message:", err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
