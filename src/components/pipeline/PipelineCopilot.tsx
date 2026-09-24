"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";

const cardClass = "rounded-xl border border-white/10 bg-black/20 p-4 space-y-3";
const btnGhost =
  "rounded-lg border border-white/15 px-3 py-1.5 text-xs text-[var(--muted)] hover:border-white/30 hover:text-[var(--cream)] disabled:opacity-50";
const btnAccent =
  "rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-50";

type CopilotItem = {
  id: string;
  kind: "flag" | "request";
  category: string;
  title: string;
  body: string;
  sourceLink: string;
  status: "pending" | "handled" | "done" | "blocked";
  requestType: string;
  resultNote: string;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  trisha: "From Trisha",
  job_search: "Job search",
  boy_scouts: "Boy Scouts",
  events: "Events",
  other: "Everything else",
  system: "Copilot requests",
};

const CATEGORY_ORDER = ["trisha", "job_search", "boy_scouts", "events", "other", "system"];

function formatCt(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
}

function RequestsList({ requests }: { requests: CopilotItem[] }) {
  if (requests.length === 0) return null;
  return (
    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-[var(--cream)]">Queued requests</h3>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[var(--cream)]">{r.title}</p>
              <span
                className={`text-xs ${
                  r.status === "done"
                    ? "text-[var(--accent)]"
                    : r.status === "blocked"
                      ? "text-[var(--warm)]"
                      : "text-[var(--muted)]"
                }`}
              >
                {r.status === "pending" ? "queued — runs next hour" : r.status}
              </span>
            </div>
            {r.body ? <p className="text-xs text-[var(--muted)]">{r.body}</p> : null}
            {r.resultNote ? <p className="text-xs text-[var(--muted)]">Bot: {r.resultNote}</p> : null}
            <p className="text-[10px] text-[var(--muted)]">{formatCt(r.createdAt)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Feed({ active }: { active: boolean }) {
  const [items, setItems] = useState<CopilotItem[]>([]);
  const [requests, setRequests] = useState<CopilotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHandled, setShowHandled] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [flagsRes, requestsRes] = await Promise.all([
        fetch(`/api/pipeline/copilot/items?kind=flag&limit=150`),
        fetch(`/api/pipeline/copilot/items?kind=request&limit=20`),
      ]);
      const flagsData = await flagsRes.json();
      const requestsData = await requestsRes.json();
      if (!flagsRes.ok) throw new Error(flagsData.error || "Failed to load feed");
      setItems(flagsData.items || []);
      setRequests(requestsRes.ok ? requestsData.items || [] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  const markHandled = useCallback(
    async (id: string) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "handled" } : i)));
      try {
        await fetch(`/api/pipeline/copilot/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "handled" }),
        });
      } catch {
        void refresh();
      }
    },
    [refresh],
  );

  const grouped = useMemo(() => {
    const visible = items.filter((i) => showHandled || i.status === "pending");
    const map = new Map<string, CopilotItem[]>();
    for (const item of visible) {
      const key = CATEGORY_ORDER.includes(item.category) ? item.category : "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return CATEGORY_ORDER.map((key) => [key, map.get(key) || []] as const).filter(
      ([, list]) => list.length > 0,
    );
  }, [items, showHandled]);

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-4">
      <RequestsList requests={requests} />
      <div className={cardClass}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--cream)]">
          Today&apos;s feed{pendingCount ? ` (${pendingCount} pending)` : ""}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={btnGhost}
            onClick={() => setShowHandled((v) => !v)}
          >
            {showHandled ? "Hide handled" : "Show handled"}
          </button>
          <button type="button" className={btnGhost} disabled={loading} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-[var(--warm)]">{error}</p> : null}
      {loading && items.length === 0 ? <p className="text-xs text-[var(--muted)]">Loading…</p> : null}
      {!loading && grouped.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Nothing flagged yet.</p>
      ) : null}

      {grouped.map(([category, list]) => (
        <div key={category} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            {CATEGORY_LABELS[category] || category}
          </h4>
          <ul className="space-y-2">
            {list.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[var(--cream)]">{item.title}</p>
                  {item.status === "pending" ? (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => void markHandled(item.id)}
                    >
                      Mark handled
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">{item.status}</span>
                  )}
                </div>
                {item.body ? <p className="text-xs text-[var(--muted)]">{item.body}</p> : null}
                <p className="text-[10px] text-[var(--muted)]">{formatCt(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
      </div>
    </div>
  );
}

function CopilotChat() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/pipeline/copilot/chat" }), []);
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [draft, setDraft] = useState("");
  const busy = status === "submitted" || status === "streaming";

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || busy) return;
      setDraft("");
      await sendMessage({ text });
    },
    [draft, busy, sendMessage],
  );

  return (
    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-[var(--cream)]">Ask the copilot</h3>
      <p className="text-xs text-[var(--muted)]">
        Ask what&apos;s open, or tell it what to do next — e.g. &quot;add the pack meeting to my
        calendar&quot; or &quot;tell the bot to reply to Trisha and say yes&quot;.
      </p>

      <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No messages yet.</p>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            <p
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                m.role === "user"
                  ? "bg-[var(--accent)] text-[var(--ink)]"
                  : "border border-white/10 bg-black/40 text-[var(--cream)]"
              }`}
            >
              {messageText(m.parts as { type: string; text?: string }[])}
            </p>
          </div>
        ))}
        {busy ? <p className="text-xs text-[var(--muted)]">Thinking…</p> : null}
      </div>

      {error ? <p className="text-xs text-[var(--warm)]">{error.message}</p> : null}

      <form onSubmit={(e) => void submit(e)} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask or tell the copilot something…"
          className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
        />
        <button type="submit" className={btnAccent} disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export function PipelineCopilot({ active }: { active: boolean }) {
  return (
    <div className="space-y-4">
      <CopilotChat />
      <Feed active={active} />
    </div>
  );
}
