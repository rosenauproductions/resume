/**
 * Chris's other public sites that report visits to this resume's DB
 * (via <script src="https://resume-rho-taupe.vercel.app/track.js" data-site="slug">).
 *
 * External visits are stored in `visits` with path `site:<slug><page path>`, so no
 * schema change is needed. Add a site here before its script will be accepted.
 * `origins` (optional): when set, only requests from these origins are stored.
 */
export type TrackedSite = { slug: string; label: string; origins?: string[] };

export const TRACKED_SITES: TrackedSite[] = [
  { slug: "familyflow", label: "FamilyFlow", origins: ["https://familyflow.ashurose.com", "https://family-wall-calendar.vercel.app"] },
  { slug: "ashurose", label: "Ashurose", origins: ["https://ashurose.com", "https://www.ashurose.com", "https://ashurose.vercel.app"] },
  { slug: "hinterviewer", label: "Hinterviewer-X", origins: ["https://hinterviewer-x.vercel.app"] },
  // Games with a public web build. Console-only (Batocera) and login-protected builds are not tracked.
  { slug: "belt-command", label: "Belt Command", origins: ["https://belt-command.vercel.app"] },
  { slug: "family-feud", label: "Family Feud", origins: ["https://family-feud-9paz.onrender.com"] },
  { slug: "one-percent-club", label: "The 1% Club", origins: ["https://the-1-percent-club.onrender.com"] },
];

export const SITE_PATH_PREFIX = "site:";

export function findTrackedSite(slug: string): TrackedSite | undefined {
  return TRACKED_SITES.find((s) => s.slug === slug);
}

/** "site:vector-strike/play" → { slug: "vector-strike", page: "/play" }; resume paths → null. */
export function parseSitePath(path: string | undefined | null): { slug: string; page: string } | null {
  if (!path || !path.startsWith(SITE_PATH_PREFIX)) return null;
  const rest = path.slice(SITE_PATH_PREFIX.length);
  const i = rest.indexOf("/");
  return i < 0 ? { slug: rest, page: "/" } : { slug: rest.slice(0, i), page: rest.slice(i) || "/" };
}

/** Filter key for a visit: "resume", "pipeline", or a site slug. */
export function visitSourceKey(path: string | undefined | null): string {
  const site = parseSitePath(path);
  if (site) return site.slug;
  const p = (path || "/").split("?")[0];
  if (p === "/pipeline" || p.startsWith("/pipeline/")) return "pipeline";
  return "resume";
}

export function visitSourceLabel(key: string): string {
  if (key === "resume") return "Resume";
  if (key === "pipeline") return "Pipeline";
  return findTrackedSite(key)?.label ?? key;
}
