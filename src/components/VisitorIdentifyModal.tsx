"use client";

import { useEffect, useId, useState } from "react";
import type { IdentifyPosition, IdentifyPromptPayload } from "@/lib/visit-identify-types";

const DISMISS_KEY = "resume-identify-dismissed";

type Step = "confirm" | "identify" | "offer" | "lead" | "thanks";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm text-[var(--cream)] outline-none placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]";

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
  const [step, setStep] = useState<Step>(prompt.suggested ? "confirm" : "identify");
  const [selectedId, setSelectedId] = useState(prompt.suggested?.id ?? "");
  const [freeText, setFreeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadTitle, setLeadTitle] = useState("");
  const [leadLocation, setLeadLocation] = useState("");
  const [leadMessage, setLeadMessage] = useState("");

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
        sessionStorage.setItem(DISMISS_KEY, "1");
        onDone();
      } else {
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
    sessionStorage.setItem(DISMISS_KEY, "1");
    onDone();
  }

  async function finishWithoutLead() {
    // Identification already saved when entering offer; just close.
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
                If you&apos;re here about a position, select the one you&apos;re considering me for:
              </p>
              <label className="block">
                <span className="sr-only">Select a position</span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className={fieldClass}
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
                    disabled={busy || (!selectedId && !freeText.trim())}
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
                      // No tracked match — save soft note, then gently offer more details
                      void submit({
                        applicationId: null,
                        freeText: freeText.trim(),
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

export function wasIdentifyDismissedThisSession() {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(DISMISS_KEY) === "1";
}
