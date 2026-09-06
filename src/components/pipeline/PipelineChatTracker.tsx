"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PipelineChatTurn = {
  id: string;
  sessionId: string;
  deviceId: string;
  visitorMessage: string;
  botReply: string;
  createdAt: string;
  visitor: {
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    leadCompany: string;
    leadTitle: string;
    freeText: string;
    applicationId: string | null;
  } | null;
  linkedJob: {
    id: string;
    company: string;
    title: string;
    location: string;
  } | null;
  latestVisit: {
    id: string;
    city: string;
    region: string;
    country: string;
    path: string;
    occurredAt: string;
    linkConfidence: string;
  } | null;
};

function formatCt(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function visitorLabel(t: PipelineChatTurn): string {
  const v = t.visitor;
  if (v?.contactName?.trim()) {
    const co = v.leadCompany?.trim();
    return co ? `${v.contactName.trim()} · ${co}` : v.contactName.trim();
  }
  if (v?.leadCompany?.trim()) {
    return v.leadTitle?.trim()
      ? `${v.leadCompany.trim()} · ${v.leadTitle.trim()}`
      : v.leadCompany.trim();
  }
  if (t.linkedJob) {
    return `${t.linkedJob.company} · ${t.linkedJob.title}`;
  }
  const loc = [t.latestVisit?.city, t.latestVisit?.region].filter(Boolean).join(", ");
  if (loc) return `Visitor · ${loc}`;
  if (t.deviceId) return `Device ${t.deviceId.slice(0, 8)}…`;
  return "Anonymous";
}

function isLinked(t: PipelineChatTurn) {
  return Boolean(t.visitor || t.linkedJob);
}

/** Device id counts as a visitor identity even when they never filled the identify form. */
function hasVisitorId(t: PipelineChatTurn) {
  return Boolean((t.deviceId || "").trim() || t.visitor || t.linkedJob || t.latestVisit);
}

type Props = {
  active: boolean;
};

export function PipelineChatTracker({ active }: Props) {
  const [turns, setTurns] = useState<PipelineChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [groupByVisitor, setGroupByVisitor] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = linkedOnly ? "?identified=1&limit=200" : "?limit=200";
      const res = await fetch(`/api/pipeline/chat${q}`);
      const data = (await res.json().catch(() => ({}))) as {
        turns?: PipelineChatTurn[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to load chat");
        setTurns([]);
        return;
      }
      setTurns(data.turns ?? []);
    } catch {
      setError("Network error loading chat");
      setTurns([]);
    } finally {
      setLoading(false);
    }
  }, [linkedOnly]);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  const groups = useMemo(() => {
    if (!groupByVisitor) return null;
    const map = new Map<string, PipelineChatTurn[]>();
    for (const t of turns) {
      const key = (t.deviceId || "").trim() || `session:${t.sessionId}` || t.id;
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return [...map.entries()]
      .map(([key, list]) => ({
        key,
        label: visitorLabel(list[0]),
        linked: isLinked(list[0]),
        turns: list,
      }))
      .sort(
        (a, b) =>
          Date.parse(b.turns[0]?.createdAt || "") - Date.parse(a.turns[0]?.createdAt || ""),
      );
  }, [groupByVisitor, turns]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--muted)]">
          Questions from the public resume chatbot, keyed by visit device ID (including
          visitors who never identified). Use the filter to hide unlinked turns.
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={linkedOnly}
              onChange={(e) => setLinkedOnly(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Identified / job-linked only
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={groupByVisitor}
              onChange={(e) => setGroupByVisitor(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Group by visitor
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:border-[var(--accent)]"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-[var(--warm)]/40 px-4 py-3 text-sm text-[var(--warm)]">
          {error}
        </p>
      ) : null}

      {!turns.length && !loading ? (
        <p className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-[var(--muted)]">
          {linkedOnly
            ? "No identified or job-linked chat yet. Uncheck the filter to see anonymous turns, or wait for someone who identified / got visit-linked."
            : "No chat turns logged yet."}
        </p>
      ) : null}

      {groups ? (
        <ul className="space-y-4">
          {groups.map((g) => (
            <li
              key={g.key}
              className="overflow-hidden rounded-xl border border-white/10"
            >
              <div className="flex flex-wrap items-baseline gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="font-[family-name:var(--font-display)] text-[var(--cream)]">
                  {g.label}
                </p>
                <span className="text-xs text-[var(--muted)]">
                  {g.turns.length} turn{g.turns.length === 1 ? "" : "s"}
                  {g.linked
                    ? " · identified"
                    : hasVisitorId(g.turns[0])
                      ? " · visitor id"
                      : " · anonymous"}
                </span>
                {g.turns[0]?.linkedJob ? (
                  <span className="text-xs text-[var(--accent)]">
                    {g.turns[0].linkedJob.company} — {g.turns[0].linkedJob.title}
                  </span>
                ) : null}
                {g.turns[0]?.visitor?.contactEmail ? (
                  <span className="text-xs text-[var(--muted)]">
                    {g.turns[0].visitor.contactEmail}
                  </span>
                ) : null}
              </div>
              <ul className="divide-y divide-white/10">
                {g.turns.map((t) => (
                  <li key={t.id} className="space-y-2 px-4 py-3">
                    <p className="text-[11px] tabular-nums text-[var(--muted)]">
                      {formatCt(t.createdAt)} CT
                    </p>
                    <p className="text-sm text-[var(--cream)]">
                      <span className="text-[var(--accent)]">Q: </span>
                      {t.visitorMessage}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      <span className="text-[var(--cream)]/70">A: </span>
                      {t.botReply}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {turns.map((t) => (
            <li key={t.id} className="space-y-2 px-4 py-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="font-[family-name:var(--font-display)] text-sm text-[var(--cream)]">
                  {visitorLabel(t)}
                </p>
                <span className="text-[11px] tabular-nums text-[var(--muted)]">
                  {formatCt(t.createdAt)} CT
                </span>
                {isLinked(t) ? (
                  <span className="text-[11px] text-[var(--accent)]">linked</span>
                ) : null}
              </div>
              {t.linkedJob ? (
                <p className="text-xs text-[var(--accent)]">
                  {t.linkedJob.company} — {t.linkedJob.title}
                </p>
              ) : null}
              <p className="text-sm text-[var(--cream)]">
                <span className="text-[var(--accent)]">Q: </span>
                {t.visitorMessage}
              </p>
              <p className="text-sm text-[var(--muted)]">
                <span className="text-[var(--cream)]/70">A: </span>
                {t.botReply}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
