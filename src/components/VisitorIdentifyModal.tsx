"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  hasVisitorIdentifiedClient,
  markVisitorIdentifiedClient,
  wasIdentifyDismissedThisSession,
  IDENTIFY_DISMISS_SESSION_KEY,
} from "@/lib/identify-persistence";
import type { IdentifyPosition, IdentifyPromptPayload } from "@/lib/visit-identify-types";

type Step = "confirm" | "identify" | "offer" | "lead" | "thanks";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm text-[var(--cream)] outline-none placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]";

function positionLabel(p: IdentifyPosition) {
  return `${p.company} — ${p.title}`;
}

function matchPositions(positions: IdentifyPosition[], query: string): IdentifyPosition[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return positions
    .map((p) => {
      const hay = `${p.company} ${p.title}`.toLowerCase();
      if (!tokens.every((t) => hay.includes(t))) return null;
      const starts =
        p.company.toLowerCase().startsWith(q) || p.title.toLowerCase().startsWith(q) ? 1 : 0;
      return { p, score: starts, hay };
    })
    .filter((x): x is { p: IdentifyPosition; score: number; hay: string } => Boolean(x))
    .sort((a, b) => b.score - a.score || a.hay.localeCompare(b.hay))
    .slice(0, 6)
    .map((x) => x.p);
}

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
  const listboxId = useId();
  const queryRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(prompt.suggested ? "confirm" : "identify");
  const [selectedId, setSelectedId] = useState(prompt.suggested?.id ?? "");
  const [query, setQuery] = useState(
    prompt.suggested ? positionLabel(prompt.suggested) : "",
  );
  const [freeText, setFreeText] = useState("");
  const [hintsOpen, setHintsOpen] = useState(false);
  const [activeHint, setActiveHint] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadTitle, setLeadTitle] = useState("");
  const [leadLocation, setLeadLocation] = useState("");
  const [leadMessage, setLeadMessage] = useState("");

  const hints = selectedId ? [] : matchPositions(prompt.positions, query);

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
    lead?: {
      name: string;
      email: string;
      phone?: string;
      company: string;
      title?: string;
      location?: string;
      message?: string;
    } | null;
    nextStep?: Step | "done";
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
          lead: opts.lead ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save — try again");
        setBusy(false);
        return false;
      }
      if (opts.nextStep === "done" || !opts.nextStep) {
        markVisitorIdentifiedClient();
        onDone();
      } else {
        // Soft note / offer path — still counts as identified so we don't re-ask
        markVisitorIdentifiedClient();
        setStep(opts.nextStep);
        setBusy(false);
      }
      return true;
    } catch {
      setError("Network error — try again");
      setBusy(false);
      return false;
    }
  }

  function dismiss() {
    try {
      sessionStorage.setItem(IDENTIFY_DISMISS_SESSION_KEY, "1");
    } catch {
      // ignore
    }
    onDone();
  }

  async function finishWithoutLead() {
    // Identification already saved when entering offer; just close.
    markVisitorIdentifiedClient();
    onDone();
  }

  const suggested = prompt.suggested;

  function pickPosition(p: IdentifyPosition) {
    setSelectedId(p.id);
    setQuery(positionLabel(p));
    setHintsOpen(false);
    setActiveHint(0);
    setError("");
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setSelectedId("");
    setHintsOpen(true);
    setActiveHint(0);
  }

  function onQueryKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!hintsOpen || !hints.length) {
      if (e.key === "Escape") setHintsOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveHint((i) => (i + 1) % hints.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveHint((i) => (i - 1 + hints.length) % hints.length);
    } else if (e.key === "Enter" && hints[activeHint]) {
      e.preventDefault();
      pickPosition(hints[activeHint]);
    } else if (e.key === "Escape") {
      setHintsOpen(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--ink)]/75 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-2xl border border-white/12 bg-[var(--panel)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 10% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 100%, color-mix(in oklab, var(--warm) 12%, transparent), transparent 60%)",
          }}
        />
        <div className="relative space-y-4 p-6 sm:p-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent)]">
              {step === "lead" || step === "offer" || step === "thanks"
                ? "Optional"
                : "Welcome back"}
            </p>
            <h2
              id={titleId}
              className="mt-2 font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--cream)]"
            >
              {step === "offer"
                ? "Want to leave a little more?"
                : step === "lead"
                  ? "A few details help me follow up."
                  : step === "thanks"
                    ? "Appreciate it."
                    : "Thanks for taking another look at my resume."}
            </h2>
            {step === "confirm" || step === "identify" ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">What brought you back?</p>
            ) : null}
            {step === "offer" ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Totally optional — if you&apos;d like, you can share contact info and what you&apos;re
                hiring for so I can follow up. No pressure either way.
              </p>
            ) : null}
            {step === "thanks" ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                I marked this as a website lead and will take a look soon.
              </p>
            ) : null}
          </div>

          {step === "confirm" && suggested ? (
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
                      nextStep: "done",
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
                    setStep("identify");
                    setSelectedId("");
                    setQuery("");
                    setHintsOpen(false);
                    requestAnimationFrame(() => queryRef.current?.focus());
                  }}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-[var(--cream)] hover:border-white/30"
                >
                  Pick another
                </button>
              </div>
            </div>
          ) : null}

          {step === "identify" ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                If you&apos;re here about a position, start typing the company or role — matching
                hints appear as you type.
              </p>
              <div className="relative">
                <label className="block">
                  <span className="sr-only">Search positions</span>
                  <input
                    ref={queryRef}
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onFocus={() => setHintsOpen(true)}
                    onBlur={() => {
                      // Allow hint click before closing
                      window.setTimeout(() => setHintsOpen(false), 120);
                    }}
                    onKeyDown={onQueryKeyDown}
                    className={fieldClass}
                    placeholder="e.g. Acme, instructional design…"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={hintsOpen && hints.length > 0}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                  />
                </label>
                {selectedId ? (
                  <p className="mt-1.5 text-xs text-[var(--accent)]">Matched a tracked position</p>
                ) : null}
                {hintsOpen && hints.length > 0 ? (
                  <ul
                    id={listboxId}
                    role="listbox"
                    className="absolute z-10 mt-1.5 max-h-48 w-full overflow-auto rounded-xl border border-white/12 bg-[var(--panel)] py-1 shadow-lg"
                  >
                    {hints.map((p, i) => (
                      <li key={p.id} role="option" aria-selected={i === activeHint}>
                        <button
                          type="button"
                          className={`block w-full px-3 py-2 text-left text-sm ${
                            i === activeHint
                              ? "bg-[var(--accent)]/20 text-[var(--cream)]"
                              : "text-[var(--cream)] hover:bg-white/5"
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActiveHint(i)}
                          onClick={() => pickPosition(p)}
                        >
                          <span className="font-medium">{p.company}</span>
                          <span className="text-[var(--muted)]"> — {p.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {hintsOpen && query.trim() && !selectedId && hints.length === 0 ? (
                  <p className="mt-1.5 text-xs text-[var(--muted)]">
                    No tracked match — add a note below if you like.
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-[var(--muted)]">
                Not seeing it? That&apos;s okay — just let me know what you&apos;re looking for.
              </p>
              <textarea
                rows={3}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="e.g. instructional design role in DFW, multimedia contractor…"
                className={fieldClass}
              />
            </div>
          ) : null}

          {step === "offer" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setLeadMessage(freeText);
                  setStep("lead");
                }}
                className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
              >
                Sure — leave details
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finishWithoutLead()}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-[var(--cream)] hover:border-white/30"
              >
                I&apos;m good for now
              </button>
            </div>
          ) : null}

          {step === "lead" ? (
            <div className="space-y-3">
              <label className="block text-xs text-[var(--muted)]">
                Your name
                <input
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className={fieldClass}
                  placeholder="Alex Rivera"
                  autoComplete="name"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Work email
                <input
                  required
                  type="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className={fieldClass}
                  placeholder="alex@company.com"
                  autoComplete="email"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Company
                <input
                  required
                  value={leadCompany}
                  onChange={(e) => setLeadCompany(e.target.value)}
                  className={fieldClass}
                  placeholder="Company name"
                  autoComplete="organization"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-[var(--muted)]">
                  Role / title
                  <input
                    value={leadTitle}
                    onChange={(e) => setLeadTitle(e.target.value)}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Location
                  <input
                    value={leadLocation}
                    onChange={(e) => setLeadLocation(e.target.value)}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <label className="block text-xs text-[var(--muted)]">
                Phone <span className="text-[var(--muted)]/70">(optional)</span>
                <input
                  type="tel"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  className={fieldClass}
                  placeholder="Optional"
                  autoComplete="tel"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                What are you hiring for?
                <textarea
                  rows={3}
                  value={leadMessage}
                  onChange={(e) => setLeadMessage(e.target.value)}
                  className={fieldClass}
                  placeholder="A sentence or two is plenty"
                />
              </label>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {step === "thanks" ? (
              <button
                type="button"
                onClick={dismiss}
                className="ml-auto rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-xs text-[var(--muted)] hover:text-[var(--cream)]"
                >
                  Not now
                </button>
                {step === "identify" ? (
                  <button
                    type="button"
                    disabled={busy || (!selectedId && !freeText.trim() && !query.trim())}
                    onClick={() => {
                      if (selectedId) {
                        void submit({
                          applicationId: selectedId,
                          freeText: freeText.trim(),
                          confirmedSuggested: false,
                          nextStep: "done",
                        });
                        return;
                      }
                      // No tracked match — save soft note (query counts as note), then offer more
                      const note = freeText.trim() || query.trim();
                      void submit({
                        applicationId: null,
                        freeText: note,
                        confirmedSuggested: false,
                        nextStep: "offer",
                      });
                    }}
                    className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
                  >
                    {busy ? "Saving…" : "Continue →"}
                  </button>
                ) : null}
                {step === "lead" ? (
                  <button
                    type="button"
                    disabled={
                      busy || !leadName.trim() || !leadEmail.trim() || !leadCompany.trim()
                    }
                    onClick={() =>
                      void submit({
                        applicationId: null,
                        freeText: freeText.trim() || leadMessage.trim(),
                        confirmedSuggested: false,
                        lead: {
                          name: leadName.trim(),
                          email: leadEmail.trim(),
                          phone: leadPhone.trim(),
                          company: leadCompany.trim(),
                          title: leadTitle.trim(),
                          location: leadLocation.trim(),
                          message: leadMessage.trim(),
                        },
                        nextStep: "thanks",
                      })
                    }
                    className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
                  >
                    {busy ? "Sending…" : "Send details →"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { wasIdentifyDismissedThisSession, hasVisitorIdentifiedClient } from "@/lib/identify-persistence";
