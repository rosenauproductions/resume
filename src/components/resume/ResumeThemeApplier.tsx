"use client";

import { useEffect } from "react";
import type { ResumeThemeId } from "@/lib/resume/types";

/** Applies theme on <html> without changing default (dark) look when theme is dark. */
export function ResumeThemeApplier({ theme }: { theme: ResumeThemeId }) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    return () => {
      root.removeAttribute("data-theme");
    };
  }, [theme]);
  return null;
}
