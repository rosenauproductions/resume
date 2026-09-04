"use client";

import { useEffect, useId, useRef, useState } from "react";

export type PrintMode = "dark" | "light";

/** Walk the page so whileInView / scroll reveals finish before print. */
async function revealPageForPrint() {
  const scrollingEl = document.scrollingElement || document.documentElement;
  const startY = window.scrollY;
  const maxY = Math.max(0, scrollingEl.scrollHeight - window.innerHeight);
  const step = Math.max(240, Math.floor(window.innerHeight * 0.7));

  for (let y = 0; y <= maxY; y += step) {
    window.scrollTo(0, y);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
  window.scrollTo(0, maxY);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  window.scrollTo(0, startY);
  await new Promise((r) => window.setTimeout(r, 80));
}

/** Set print theme, open the system print dialog (Save as PDF), then clear. */
export async function printResume(mode: PrintMode) {
  const root = document.documentElement;
  root.setAttribute("data-print-mode", mode);

  const cleanup = () => {
    root.removeAttribute("data-print-mode");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  try {
    await revealPageForPrint();
  } catch {
    // still attempt print
  }

  window.print();
  window.setTimeout(cleanup, 1500);
}

export function PrintResumeMenu({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  async function choose(mode: PrintMode) {
    setOpen(false);
    setBusy(true);
    try {
      await printResume(mode);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative no-print ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "rounded-full border border-white/15 px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--cream)] disabled:opacity-50"
            : "rounded-full border border-white/20 px-4 py-2 text-sm text-[var(--cream)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        }
      >
        {busy ? "Preparing…" : "Save PDF"}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[14rem] rounded-xl border border-white/12 bg-[var(--ink)]/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left hover:bg-white/5"
            onClick={() => void choose("dark")}
          >
            <span className="text-sm text-[var(--cream)]">Dark PDF</span>
            <span className="mt-0.5 text-[11px] text-[var(--muted)]">
              Same look as the site (colors &amp; art)
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left hover:bg-white/5"
            onClick={() => void choose("light")}
          >
            <span className="text-sm text-[var(--cream)]">Print-friendly PDF</span>
            <span className="mt-0.5 text-[11px] text-[var(--muted)]">
              White page · text only (no images)
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
