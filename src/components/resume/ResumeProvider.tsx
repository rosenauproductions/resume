"use client";

import { createContext, useContext, useMemo } from "react";
import { buildDefaultResumeContent } from "@/lib/resume/defaults";
import type { ResumeContent, ResumeLensId } from "@/lib/resume/types";

type ResumeContextValue = {
  content: ResumeContent;
  lens: ResumeLensId;
};

const ResumeContext = createContext<ResumeContextValue | null>(null);

export function ResumeProvider({
  content,
  lens = "ai",
  children,
}: {
  content: ResumeContent;
  lens?: ResumeLensId;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ content, lens }), [content, lens]);
  return <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>;
}

/** Always returns content — falls back to static defaults so layout never breaks. */
export function useResume(): ResumeContent {
  const ctx = useContext(ResumeContext);
  return useMemo(() => ctx?.content ?? buildDefaultResumeContent(), [ctx]);
}

export function useResumeLens(): ResumeLensId {
  const ctx = useContext(ResumeContext);
  return ctx?.lens ?? "ai";
}
