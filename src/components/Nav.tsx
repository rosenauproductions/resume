"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useResume, useResumeLens } from "@/components/resume/ResumeProvider";
import {
  RESUME_LENS_LABELS,
  RESUME_SECTION_LABELS,
  type ResumeLensId,
  type ResumeSectionId,
} from "@/lib/resume/types";
import { LENS_SESSION_KEY, persistLensPreference, navigateToLens } from "@/lib/resume/lens-intent";
import { PrintResumeMenu } from "@/components/PrintResume";

const NAV_HREF: Partial<Record<ResumeSectionId, string>> = {
  about: "#about",
  experience: "#experience",
  work: "#work",
  projects: "#projects",
  skills: "#skills",
  fit: "#fit",
  contact: "#contact",
};

const DEFAULT_NAV_LABEL: Partial<Record<ResumeSectionId, string>> = {
  about: "About",
  experience: "Experience",
  work: "Work",
  projects: "Projects",
  skills: "Skills",
  fit: "Fit",
  contact: "Contact",
};

const LENS_HINT: Record<ResumeLensId, string> = {
  ai: "Coding · LMS · AI",
  media: "Video · design · eLearning",
};

export function LensToggle({
  lens,
  onChange,
  size = "md",
  showLabel = true,
}: {
  lens: ResumeLensId;
  onChange: (next: ResumeLensId) => void;
  size?: "md" | "lg";
  showLabel?: boolean;
}) {
  const pad = size === "lg" ? "px-3.5 py-2 text-sm" : "px-3 py-1.5 text-xs sm:text-sm";
  return (
    <div className="flex items-center gap-2">
      {showLabel ? (
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] sm:inline">
          View
        </span>
      ) : null}
      <div
        className="inline-flex rounded-full border-2 border-[var(--accent)]/45 bg-black/40 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
        role="group"
        aria-label="Resume view: Media or AI"
      >
        {(["ai", "media"] as const).map((id) => {
          const active = lens === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`rounded-full ${pad} font-semibold transition ${
                active
                  ? id === "ai"
                    ? "bg-sky-400 text-[var(--ink)] shadow-sm"
                    : "bg-[var(--accent)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--cream)]"
              }`}
              aria-pressed={active}
              title={LENS_HINT[id]}
            >
              {RESUME_LENS_LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Nav() {
  const resume = useResume();
  const lens = useResumeLens();
  const router = useRouter();
  const searchParams = useSearchParams();

  const links = resume.sectionOrder
    .filter((id) => id !== "hero" && resume.sections[id]?.enabled !== false)
    .map((id) => ({
      href: NAV_HREF[id] || `#${id}`,
      label: resume.sections[id]?.navLabel?.trim() || DEFAULT_NAV_LABEL[id] || RESUME_SECTION_LABELS[id],
    }));

  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Soft default: if URL has no lens, restore Media preference when set
  useEffect(() => {
    if (searchParams.has("lens")) {
      persistLensPreference(lens);
      return;
    }
    try {
      const pref = sessionStorage.getItem(LENS_SESSION_KEY);
      if (pref === "media") {
        router.replace("/?lens=media");
      }
    } catch {
      // ignore
    }
  }, [searchParams, lens, router]);

  function setLens(next: ResumeLensId) {
    navigateToLens(router, next);
    setOpen(false);
  }

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "border-b border-white/10 bg-[var(--ink)]/90 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6 sm:py-4">
        <a
          href="#top"
          className="shrink-0 font-[family-name:var(--font-display)] text-base tracking-tight text-[var(--cream)] sm:text-lg"
          onClick={() => setOpen(false)}
        >
          {resume.site.name}
        </a>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className="flex flex-col items-center gap-1">
            <LensToggle lens={lens} onChange={setLens} size="lg" />
            <p className="text-[10px] text-[var(--muted)]">{LENS_HINT[lens]}</p>
          </div>
        </div>

        <ul className="hidden items-center gap-5 text-sm text-[var(--muted)] xl:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="transition-colors hover:text-[var(--accent)]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="md:hidden">
            <LensToggle lens={lens} onChange={setLens} showLabel={false} />
          </div>
          <PrintResumeMenu compact className="hidden sm:block" />
          <a
            href="#contact"
            className="hidden rounded-full border border-[var(--accent)]/40 px-4 py-2 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ink)] lg:inline-flex"
            onClick={() => setOpen(false)}
          >
            Let’s talk
          </a>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-[var(--cream)] xl:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <span className="flex flex-col gap-1.5">
              <span
                className={`block h-0.5 w-5 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`}
              />
              <span className={`block h-0.5 w-5 bg-current transition ${open ? "opacity-0" : ""}`} />
              <span
                className={`block h-0.5 w-5 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border-t border-white/10 bg-[var(--ink)] px-5 py-6 xl:hidden"
          >
            <div className="mb-5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-4 py-3">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Resume view
              </p>
              <LensToggle lens={lens} onChange={setLens} size="lg" showLabel={false} />
              <p className="mt-2 text-xs text-[var(--muted)]">{LENS_HINT[lens]}</p>
            </div>
            <ul className="flex flex-col gap-4 text-lg text-[var(--cream)]">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} onClick={() => setOpen(false)}>
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#contact"
                  className="text-[var(--accent)]"
                  onClick={() => setOpen(false)}
                >
                  Let’s talk
                </a>
              </li>
              <li className="pt-2">
                <PrintResumeMenu />
              </li>
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
