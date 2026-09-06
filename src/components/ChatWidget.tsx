"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getOrCreateDeviceId } from "@/lib/device-id";

const SESSION_KEY = "resume-chat-session-id";
const WELCOME_DISMISS_KEY = "resume-chat-welcome-dismissed";

const WELCOME_PEEK =
  "Hi — I’m Chris’s portfolio assistant. Ask me about his experience, skills, or projects.";
const WELCOME_PANEL =
  "Hi! I’m here if you want the short version of Chris’s background — experience, Canvas/LMS work, video, or side projects. What are you curious about?";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "anonymous";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)?.trim();
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `chat-${Date.now().toString(36)}`;
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

function isPrivatePath(path: string) {
  return (
    path === "/pipeline" ||
    path.startsWith("/pipeline/") ||
    path === "/head-count" ||
    path.startsWith("/head-count/")
  );
}

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
}

export function ChatWidget() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("anonymous");
  const [deviceId, setDeviceId] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPrivatePath(pathname)) return;
    try {
      if (sessionStorage.getItem(WELCOME_DISMISS_KEY) === "1") return;
    } catch {
      // ignore
    }
    const timer = window.setTimeout(() => setShowWelcome(true), 1600);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { sessionId, deviceId },
      }),
    [sessionId, deviceId],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open, status]);

  function dismissWelcome() {
    setShowWelcome(false);
    try {
      sessionStorage.setItem(WELCOME_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  function openChat() {
    dismissWelcome();
    setOpen(true);
  }

  if (isPrivatePath(pathname)) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    clearError();
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="no-print fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 md:right-6 md:bottom-6">
      {!open && showWelcome ? (
        <div
          className="w-[min(100vw-2rem,18.5rem)] animate-[fadeInUp_0.45s_ease-out] rounded-2xl border border-white/12 bg-[color-mix(in_oklab,var(--panel)_96%,black)] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
          role="status"
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={openChat}
              className="min-w-0 flex-1 text-left text-sm leading-relaxed text-[var(--cream)]"
            >
              {WELCOME_PEEK}
              <span className="mt-1.5 block text-xs font-semibold text-[var(--accent)]">
                Tap to chat →
              </span>
            </button>
            <button
              type="button"
              onClick={dismissWelcome}
              className="shrink-0 rounded-lg px-1.5 py-0.5 text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--cream)]"
              aria-label="Dismiss welcome"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div
          className="flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[color-mix(in_oklab,var(--panel)_96%,black)] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-label="Ask about Chris"
        >
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--cream)]">
                Ask about Chris
              </p>
              <p className="text-xs text-[var(--muted)]">
                Portfolio assistant — not Chris himself
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--cream)]"
              aria-label="Close chat"
            >
              ✕
            </button>
          </header>

          <div
            ref={scrollerRef}
            className="flex max-h-[min(50vh,22rem)] min-h-[12rem] flex-col gap-3 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 ? (
              <div className="mr-auto max-w-[92%] rounded-2xl bg-white/6 px-3 py-2 text-sm leading-relaxed text-[var(--cream)]">
                {WELCOME_PANEL}
              </div>
            ) : null}
            {messages.map((m) => {
              const text = messageText(m.parts);
              if (!text) return null;
              const mine = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    mine
                      ? "ml-auto bg-[color-mix(in_oklab,var(--accent)_28%,transparent)] text-[var(--cream)]"
                      : "mr-auto bg-white/6 text-[var(--cream)]"
                  }`}
                >
                  {text}
                </div>
              );
            })}
            {busy ? (
              <p className="text-xs text-[var(--muted)]" aria-live="polite">
                Thinking…
              </p>
            ) : null}
            {error ? (
              <p className="text-xs text-[var(--warm)]" role="alert">
                {error.message || "Something went wrong — try again."}
              </p>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="border-t border-white/10 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                disabled={busy}
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-black/35 px-3 py-2 text-sm text-[var(--cream)] outline-none placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]"
                aria-label="Chat message"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition enabled:hover:brightness-110 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openChat();
          }
        }}
        className="rounded-full border border-white/15 bg-[color-mix(in_oklab,var(--panel)_90%,black)] px-4 py-3 text-sm font-semibold text-[var(--cream)] shadow-[0_12px_30px_rgba(0,0,0,0.4)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
        aria-expanded={open}
      >
        {open ? "Close" : "Ask about Chris"}
      </button>
    </div>
  );
}
