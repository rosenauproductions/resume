import type { ResumeLensId } from "@/lib/resume/types";

/** Public URL for a lens — AI is bare `/`, Media is `/?lens=media`, UI is `/?lens=ui`. */
export function lensHref(lens: ResumeLensId): string {
  if (lens === "media") return "/?lens=media";
  if (lens === "ui") return "/?lens=ui";
  return "/";
}

export const LENS_SESSION_KEY = "resume-lens-preference";

export function persistLensPreference(lens: ResumeLensId) {
  try {
    sessionStorage.setItem(LENS_SESSION_KEY, lens);
  } catch {
    // ignore
  }
}

export function navigateToLens(
  router: { replace: (href: string) => void },
  next: ResumeLensId,
) {
  persistLensPreference(next);
  router.replace(lensHref(next));
}

const MEDIA_CUES =
  /\b(video|multimedia|premiere|after\s*effects|vyond|motion\s*graphics|graphic\s*(arts?|design)|animation|storyboard|filming|e-?learning\s*design|instructional\s*design|articulate|rise|storyline|powerpoint|training\s*video|brand\s*media)\b/i;

const AI_CUES =
  /\b(typescript|javascript|coding|programmer|software|github|pwa|next\.?js|react|llm|claude|chatgpt|grok|ai\s*(chat|workflow|builder|engineer)|canvas\s*(lms|admin|embed|js)|aws|language\s*embed|stepbot|pistomp|hinterviewer|\blobe\b|bot|agent|pipeline|neon|full-?stack|web\s*dev)\b/i;

const UI_CUES =
  /\b(ui\s*design|ux\s*design|ui\/ux|user\s*interface|visual\s*design|layout|typography|visual\s*hierarchy|mockup|wireframe|design\s*critique|product\s*design|interaction\s*design)\b/i;

/**
 * Infer which resume lens fits a visitor message.
 * Returns null when unclear / balanced.
 */
export function suggestLensFromText(text: string): ResumeLensId | null {
  const t = (text || "").trim();
  if (t.length < 8) return null;

  let media = 0;
  let ai = 0;
  let ui = 0;
  if (MEDIA_CUES.test(t)) media += 2;
  if (AI_CUES.test(t)) ai += 2;
  if (UI_CUES.test(t)) ui += 2;

  if (/\b(multimedia|video\s*editor|motion|graphic)\b/i.test(t)) media += 1;
  if (/\b(engineer|developer|programmer|systems?|platform)\b/i.test(t)) ai += 1;
  if (/\b(designer|portfolio|figma|interface)\b/i.test(t)) ui += 1;

  const top = Math.max(ai, media, ui);
  if (top < 2) return null;
  if (ui === top && ui > ai && ui > media) return "ui";
  if (ai === top && ai > media && ai > ui) return "ai";
  if (media === top && media > ai && media > ui) return "media";
  return null;
}
