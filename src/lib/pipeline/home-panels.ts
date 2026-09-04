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
