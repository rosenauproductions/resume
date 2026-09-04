"use client";

import { createContext, useContext, useMemo } from "react";
import { buildDefaultResumeContent } from "@/lib/resume/defaults";
import type { ResumeContent } from "@/lib/resume/types";

const ResumeContext = createContext<ResumeContent | null>(null);

export function ResumeProvider({
  content,
  children,
}: {
  content: ResumeContent;
  children: React.ReactNode;
}) {
  return <ResumeContext.Provider value={content}>{children}</ResumeContext.Provider>;
}

/** Always returns content — falls back to static defaults so layout never breaks. */
export function useResume(): ResumeContent {
  const ctx = useContext(ResumeContext);
  return useMemo(() => ctx ?? buildDefaultResumeContent(), [ctx]);
}
