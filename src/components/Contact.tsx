"use client";

import { useState } from "react";
import { site as siteFallback } from "@/content/resume";
import { useResume } from "@/components/resume/ResumeProvider";
import { getOrCreateDeviceId } from "@/lib/device-id";
import {
  markVisitorLeadSubmittedClient,
  readLastVisitId,
} from "@/lib/identify-persistence";
import { Reveal } from "./Reveal";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm text-[var(--cream)] outline-none placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]";

export function Contact() {
  const resume = useResume();
  const site = resume.site ?? siteFallback;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [requestContact, setRequestContact] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!requestContact && !company.trim()) {
      setError("Add a company, or check “Please contact me”.");
      return;
    }

    setBusy(true);
    try {
      const fingerprint = getOrCreateDeviceId();
      const res = await fetch("/api/visit/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint,
          visitId: readLastVisitId(),
          freeText: message.trim(),
          lead: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            company: company.trim(),
            message: message.trim(),
            requestContact,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not send — try again.");
        return;
      }
      markVisitorLeadSubmittedClient();
      setSent(true);
    } catch {
      setError("Network error — try emailing instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="contact" className="relative pt-2 pb-16 md:pt-2 md:pb-20 lg:pt-2 lg:pb-24">
      <div className="absolute inset-0 contact-glow" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker justify-center text-center">07</p>
          <h2 className="section-title text-center">Let’s connect</h2>
          <p className="mx-auto mt-5 max-w-xl text-center text-lg text-[var(--muted)]">
            {site.location} · Open to instructional design, eLearning, corporate training,
            and multimedia production.
          </p>
        </Reveal>

        <Reveal
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          delay={0.1}
        >
          <a
            href={`mailto:${site.email}`}
            className="min-w-[240px] rounded-full bg-[var(--cream)] px-8 py-4 text-center text-sm font-semibold text-[var(--ink)] transition-transform hover:scale-[1.03]"
          >
            {site.email}
          </a>
          <a
            href={site.phoneHref}
            className="min-w-[240px] rounded-full border border-white/20 px-8 py-4 text-center font-mono text-sm text-[var(--cream)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {site.phone}
          </a>
        </Reveal>

        <Reveal className="mt-10 text-center" delay={0.15}>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
          >
            {site.linkedinLabel}
          </a>
        </Reveal>

        <Reveal className="mx-auto mt-16 max-w-lg" delay={0.2}>
          <div className="rounded-2xl border border-white/12 bg-black/25 px-5 py-6 sm:px-6">
            <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
              Leave your contact info
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              New here or ready to talk? Share a few details and I&apos;ll follow up when it
              makes sense.
            </p>

            {sent ? (
              <p className="mt-6 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
                Thanks — I received your note
                {requestContact ? " and will reach out" : ""}.
              </p>
            ) : (
              <form className="mt-6 space-y-3" onSubmit={(e) => void onSubmit(e)}>
                <label className="block text-xs text-[var(--muted)]">
                  Your name
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={fieldClass}
                    placeholder="Alex Rivera"
                    autoComplete="name"
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Email
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldClass}
                    placeholder="alex@company.com"
                    autoComplete="email"
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Company <span className="text-[var(--muted)]/70">(optional if requesting contact)</span>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={fieldClass}
                    placeholder="Company name"
                    autoComplete="organization"
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Phone <span className="text-[var(--muted)]/70">(optional)</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={fieldClass}
                    placeholder="Optional"
                    autoComplete="tel"
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Message <span className="text-[var(--muted)]/70">(optional)</span>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={fieldClass}
                    placeholder="What you’re hiring for, timing, or how to reach you"
                  />
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-[var(--cream)]">
                  <input
                    type="checkbox"
                    checked={requestContact}
                    onChange={(e) => setRequestContact(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    Please contact me
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      I’ll follow up by email (or phone if you left one).
                    </span>
                  </span>
                </label>
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--ink)] transition-opacity disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </div>

      <footer className="relative mx-auto mt-24 max-w-6xl border-t border-white/10 px-6 pt-8 text-center text-sm text-[var(--muted)]">
        <p>
          © {new Date().getFullYear()} {site.name}
        </p>
      </footer>
    </section>
  );
}
