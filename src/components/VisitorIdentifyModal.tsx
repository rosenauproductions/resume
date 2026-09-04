"use client";

import { useEffect, useId, useState } from "react";
import type { IdentifyPosition, IdentifyPromptPayload } from "@/lib/visit-identify-types";

const DISMISS_KEY = "resume-identify-dismissed";

export function VisitorIdentifyModal({
  prompt,
  fingerprint,
  onDone,
}: {
  prompt: IdentifyPromptPayload;
  fingerprint: string;
  onDone: () => void;
}) {
  const titleId = useId();
  const [selectedId, setSelectedId] = useState(prompt.suggested?.id ?? "");
  const [freeText, setFreeText] = useState("");
  const [confirmMode, setConfirmMode] = useState(Boolean(prompt.suggested));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function submit(opts: {
    applicationId?: string | null;
    freeText?: string;
    confirmedSuggested?: boolean;
  }) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/visit/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint,
          visitId: prompt.visitId,
          applicationId: opts.applicationId ?? null,
          freeText: opts.freeText ?? "",
          confirmedSuggested: Boolean(opts.confirmedSuggested),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save — try again");
        setBusy(false);
        return;
      }
      sessionStorage.setItem(DISMISS_KEY, "1");
      onDone();
    } catch {
      setError("Network error — try again");
      setBusy(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    onDone();
  }

  const suggested = prompt.suggested;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--ink)]/75 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[var(--panel)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 10% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 100%, color-mix(in oklab, var(--warm) 12%, transparent), transparent 60%)",
          }}
        />
        <div className="relative space-y-4 p-6 sm:p-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent)]">Welcome back</p>
            <h2
              id={titleId}
              className="mt-2 font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--cream)]"
            >
              Thanks for taking another look at my resume.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">What brought you back?</p>
          </div>

          {confirmMode && suggested ? (
            <div className="space-y-3 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-4 py-3">
              <p className="text-sm text-[var(--cream)]">
                Is this you — considering me for{" "}
                <strong className="text-[var(--accent)]">
                  {suggested.company} — {suggested.title}
                </strong>
                ?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void submit({
                      applicationId: suggested.id,
                      confirmedSuggested: true,
                    })
                  }
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                >
                  Yes, that&apos;s me
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirmMode(false);
                    setSelectedId("");
                  }}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-[var(--cream)] hover:border-white/30"
                >
                  Pick another
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                If you&apos;re here about a position, select the one you&apos;re considering me for:
              </p>
              <label className="block">
                <span className="sr-only">Select a position</span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm text-[var(--cream)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Select a position</option>
                  {prompt.positions.map((p: IdentifyPosition) => (
                    <option key={p.id} value={p.id}>
                      {p.company} — {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-[var(--muted)]">
                Not sure which? That&apos;s okay — just let me know what you&apos;re looking for.
              </p>
              <textarea
                rows={3}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="e.g. instructional design role in DFW, multimedia contractor…"
                className="w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm text-[var(--cream)] outline-none placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]"
              />
            </div>
          )}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-[var(--muted)] hover:text-[var(--cream)]"
            >
              Not now
            </button>
            {!confirmMode ? (
              <button
                type="button"
                disabled={busy || (!selectedId && !freeText.trim())}
                onClick={() =>
                  void submit({
                    applicationId: selectedId || null,
                    freeText: freeText.trim(),
                    confirmedSuggested: false,
                  })
                }
                className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
              >
                {busy ? "Saving…" : "Continue →"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function wasIdentifyDismissedThisSession() {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(DISMISS_KEY) === "1";
}
