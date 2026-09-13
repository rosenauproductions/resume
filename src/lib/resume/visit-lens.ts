import { isResumeLensId, type ResumeLensId } from "@/lib/resume/types";

/**
 * Parse Media/AI lens from a stored visit path.
 * Default public URL `/` is AI; Media is `/?lens=media`.
 * `/?lens=ai` still counts as AI (shareable / legacy).
 */
export function resumeLensFromPath(path: string): ResumeLensId | null {
  const raw = (path || "").trim();
  if (!raw) return "ai";
  const base = raw.split("?")[0] || "/";
  if (base === "/pipeline" || base.startsWith("/pipeline/")) return null;
  if (base === "/head-count" || base.startsWith("/head-count/")) return null;
  if (base !== "/" && base !== "") return null;

  try {
    const u = new URL(
      raw.includes("://") ? raw : `https://resume.local${raw.startsWith("/") ? raw : `/${raw}`}`,
    );
    const lens = u.searchParams.get("lens");
    if (isResumeLensId(lens)) return lens;
  } catch {
    if (/[?&]lens=media\b/i.test(raw)) return "media";
    if (/[?&]lens=ai\b/i.test(raw)) return "ai";
  }
  return "ai";
}

export function resumeLensLabel(lens: ResumeLensId): string {
  return lens === "ai" ? "AI" : "Media";
}

/** Canonical path stored on visits + sent from the client. */
export function visitPathForLens(lens: ResumeLensId): string {
  return lens === "media" ? "/?lens=media" : "/";
}

export function visitNotifyTitleForPath(path: string): string {
  if (path === "/pipeline" || path.startsWith("/pipeline/")) {
    return "Pipeline visited";
  }
  const lens = resumeLensFromPath(path);
  if (lens === "ai") return "AI resume visit";
  if (lens === "media") return "Media resume visit";
  return "Resume site visit";
}
