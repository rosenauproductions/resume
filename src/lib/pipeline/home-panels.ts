/** Dismissible panels on the pipeline home / insights dashboard. */
export const PIPELINE_HOME_PANELS = [
  { id: "stat-applications", label: "Applications" },
  { id: "stat-avg-match", label: "Avg match" },
  { id: "stat-interviews", label: "Interviews open" },
  { id: "stat-avg-pay", label: "Avg known pay" },
  { id: "chart-status", label: "Pipeline mix" },
  { id: "chart-match-bands", label: "Match score bands" },
  { id: "chart-match-levels", label: "Match level mix" },
  { id: "chart-timeline", label: "Applications over time" },
  { id: "chart-salary", label: "Salary vs prior" },
  { id: "panel-targets", label: "Current targets" },
  { id: "panel-lean-into", label: "Lean into" },
  { id: "panel-watch-gaps", label: "Watch gaps" },
  { id: "panel-date-policy", label: "Date policy" },
  { id: "panel-strategy", label: "Strategy" },
  { id: "panel-exact-dates", label: "Exact dates only" },
  { id: "panel-top-matches", label: "Top match scores" },
  { id: "panel-top-pay", label: "Highest known pay" },
  { id: "panel-strengths", label: "Profile strengths" },
  { id: "panel-risks", label: "Application risks" },
] as const;

export type PipelineHomePanelId = (typeof PIPELINE_HOME_PANELS)[number]["id"];

export const DEFAULT_HOME_PANEL_ORDER: PipelineHomePanelId[] = PIPELINE_HOME_PANELS.map(
  (p) => p.id,
);

const VALID_HOME_PANEL_IDS = new Set<string>(DEFAULT_HOME_PANEL_ORDER);

export function isHomeStatPanel(id: string): boolean {
  return id.startsWith("stat-");
}

/** Keep known ids, append any missing defaults (stable for new panels). */
export function normalizeHomePanelOrder(raw: unknown): PipelineHomePanelId[] {
  const incoming = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && VALID_HOME_PANEL_IDS.has(id))
    : [];
  const seen = new Set(incoming);
  const rest = DEFAULT_HOME_PANEL_ORDER.filter((id) => !seen.has(id));
  return [...incoming, ...rest] as PipelineHomePanelId[];
}

/** Move `fromId` to sit where `toId` currently is (same list). */
export function moveHomePanelId(
  order: readonly string[],
  fromId: string,
  toId: string,
): string[] {
  if (fromId === toId) return [...order];
  const next = [...order];
  const from = next.indexOf(fromId);
  const to = next.indexOf(toId);
  if (from < 0 || to < 0) return next;
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}
