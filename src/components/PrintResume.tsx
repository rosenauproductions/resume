"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useResumeLens } from "@/components/resume/ResumeProvider";
import { RESUME_PDF_PATHS } from "@/components/print/ResumeDocument";

/**
 * "Resume PDF" menu: a recruiter-ready PDF for the current view (static file in
 * public/resume/) and a printable page (/print) that always reflects live content.
 */
export function PrintResumeMenu({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const lens = useResumeLens();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left hover:bg-white/5";

  return (
    <div ref={rootRef} className={`relative no-print ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "rounded-full border border-white/15 px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--cream)]"
            : "rounded-full border border-white/20 px-4 py-2 text-sm text-[var(--cream)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        }
      >
        Resume PDF
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[15rem] rounded-xl border border-white/12 bg-[var(--ink)]/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <a role="menuitem" className={item} href={RESUME_PDF_PATHS[lens]} download onClick={() => setOpen(false)}>
            <span className="text-sm text-[var(--cream)]">Download PDF</span>
            <span className="mt-0.5 text-[11px] text-[var(--muted)]">Two-page resume for this view</span>
          </a>
          <a
            role="menuitem"
            className={item}
            href={lens === "ai" ? "/print" : `/print?lens=${lens}`}
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
          >
            <span className="text-sm text-[var(--cream)]">Printable version</span>
            <span className="mt-0.5 text-[11px] text-[var(--muted)]">Opens a clean page to print or save</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
