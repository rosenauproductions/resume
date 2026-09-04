"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useResume } from "@/components/resume/ResumeProvider";
import {
  RESUME_SECTION_LABELS,
  type ResumeSectionId,
} from "@/lib/resume/types";

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

export function Nav() {
  const resume = useResume();
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
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
        <a
          href="#top"
          className="font-[family-name:var(--font-display)] text-base tracking-tight text-[var(--cream)] sm:text-lg"
          onClick={() => setOpen(false)}
        >
          {resume.site.name}
        </a>

        <ul className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
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

        <div className="flex items-center gap-3">
          <a
            href="#contact"
            className="hidden rounded-full border border-[var(--accent)]/40 px-4 py-2 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ink)] sm:inline-flex"
            onClick={() => setOpen(false)}
          >
            Let’s talk
          </a>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-[var(--cream)] md:hidden"
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
            className="border-t border-white/10 bg-[var(--ink)] px-5 py-6 md:hidden"
          >
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
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
