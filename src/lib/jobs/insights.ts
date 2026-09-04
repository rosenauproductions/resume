import type { JobApplication, JobStatus, TrackerMeta } from "./types";

export type GuidanceItem = {
  label: string;
  reason: string;
  score: number;
};

export type ChartPoint = { label: string; value: number; color?: string };

export type Insights = {
  total: number;
  appliedThisWeek: number;
  interviewsOpen: number;
  responseRate: number;
  rejected: number;
  withMatchScore: number;
  avgMatchScore: number | null;
  abovePriorSalary: number;
  knownSalaryCount: number;
  avgAnnualMid: number | null;
  byStatus: Record<JobStatus, number>;
  statusChart: ChartPoint[];
  matchLevelChart: ChartPoint[];
  matchScoreChart: ChartPoint[];
  salaryVsPriorChart: ChartPoint[];
  timelineChart: ChartPoint[];
  topMatches: JobApplication[];
  topPay: JobApplication[];
  leanInto: GuidanceItem[];
  beCautious: GuidanceItem[];
  gapThemes: GuidanceItem[];
};

const STATUS_COLORS: Record<JobStatus, string> = {
  researching: "#9aafbf",
  applied: "#3fd0c9",
  screen: "#7dd3c9",
  interview: "#e8a35c",
  offer: "#6ee7b7",
  rejected: "#f87171",
  withdrawn: "#a78bfa",
  avoid: "#64748b",
};

function weeksAgo(dateStr: string, weeks: number) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  return d >= cutoff;
}

function tagKey(tag: string) {
  return tag.trim().toLowerCase();
}

export function computeInsights(jobs: JobApplication[], meta?: TrackerMeta | null): Insights {
  const prior = meta?.lastSalary ?? 79000;
  const byStatus = {
    researching: 0,
    applied: 0,
    screen: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
    avoid: 0,
  } satisfies Record<JobStatus, number>;

  for (const job of jobs) byStatus[job.status] += 1;

  const appliedThisWeek = jobs.filter((j) => j.dateApplied && weeksAgo(j.dateApplied, 1)).length;
  const interviewsOpen = byStatus.screen + byStatus.interview;
  const decided =
    byStatus.offer + byStatus.rejected + byStatus.withdrawn + byStatus.interview + byStatus.screen;
  const started = jobs.filter((j) => j.status !== "researching" && j.status !== "avoid").length;
  const responseRate = started === 0 ? 0 : Math.round((decided / started) * 100);

  const scored = jobs.filter((j) => j.matchScore != null);
  const avgMatchScore =
    scored.length === 0
      ? null
      : Math.round((scored.reduce((s, j) => s + (j.matchScore ?? 0), 0) / scored.length) * 10) / 10;

  const withPay = jobs.filter((j) => j.annualMid != null && j.annualMid > 0);
  const avgAnnualMid =
    withPay.length === 0
      ? null
      : Math.round(withPay.reduce((s, j) => s + (j.annualMid ?? 0), 0) / withPay.length);
  const abovePriorSalary = withPay.filter((j) => (j.annualMid ?? 0) >= prior).length;

  const statusChart: ChartPoint[] = (Object.keys(byStatus) as JobStatus[])
    .filter((k) => byStatus[k] > 0)
    .map((k) => ({
      label: k,
      value: byStatus[k],
      color: STATUS_COLORS[k],
    }));

  const levelMap = new Map<string, number>();
  for (const job of jobs) {
    const level = job.matchLevel?.trim() || (job.matchScore != null ? "Scored" : "Unknown");
    const key = level.split(" but ")[0].trim();
    levelMap.set(key, (levelMap.get(key) ?? 0) + 1);
  }
  const matchLevelChart: ChartPoint[] = [...levelMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const buckets = [
    { label: "9–10", min: 9, max: 10.1 },
    { label: "8–8.9", min: 8, max: 9 },
    { label: "7–7.9", min: 7, max: 8 },
    { label: "<7", min: 0, max: 7 },
    { label: "Unknown", min: -1, max: -1 },
  ];
  const matchScoreChart: ChartPoint[] = buckets.map((b) => ({
    label: b.label,
    value:
      b.min < 0
        ? jobs.filter((j) => j.matchScore == null).length
        : jobs.filter((j) => j.matchScore != null && j.matchScore! >= b.min && j.matchScore! < b.max)
            .length,
    color: b.min >= 9 ? "#3fd0c9" : b.min >= 8 ? "#7dd3c9" : b.min >= 7 ? "#e8a35c" : "#9aafbf",
  }));

  const salaryVsPriorChart: ChartPoint[] = withPay
    .slice()
    .sort((a, b) => (b.annualMid ?? 0) - (a.annualMid ?? 0))
    .slice(0, 12)
    .map((j) => ({
      label: j.shortName || j.company.split(" ")[0],
      value: Math.round(j.annualMid ?? 0),
      color: (j.annualMid ?? 0) >= prior ? "#3fd0c9" : "#e8a35c",
    }));

  const byDay = new Map<string, number>();
  for (const job of jobs) {
    if (!job.dateApplied) continue;
    byDay.set(job.dateApplied, (byDay.get(job.dateApplied) ?? 0) + 1);
  }
  const timelineChart: ChartPoint[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value, color: "#3fd0c9" }));

  // Skill / match theme scoring
  const tagScores = new Map<string, { score: number; n: number; wins: number; losses: number }>();
  const gapScores = new Map<string, number>();

  for (const job of jobs) {
    let delta = 0;
    if (job.status === "offer" || job.status === "interview") delta = 2;
    else if (job.status === "screen") delta = 1;
    else if (job.status === "rejected") delta = -2;
    else if (job.status === "avoid") delta = -3;
    else if (job.matchScore != null) delta = job.matchScore >= 9 ? 1 : job.matchScore < 7 ? -1 : 0;

    const themes = job.strongMatches.length ? job.strongMatches : job.tags;
    for (const tag of themes) {
      const key = tagKey(tag);
      if (!key) continue;
      const cur = tagScores.get(key) ?? { score: 0, n: 0, wins: 0, losses: 0 };
      cur.score += delta + (job.matchScore ?? 0) * 0.1;
      cur.n += 1;
      if (delta > 0 || (job.matchScore ?? 0) >= 9) cur.wins += 1;
      if (delta < 0 || (job.matchScore ?? 0) > 0 && (job.matchScore ?? 0) < 7) cur.losses += 1;
      tagScores.set(key, cur);
    }
    for (const gap of job.gaps) {
      const key = tagKey(gap);
      if (!key) continue;
      gapScores.set(key, (gapScores.get(key) ?? 0) + 1);
    }
  }

  const ranked = [...tagScores.entries()]
    .filter(([, v]) => v.n >= 2)
    .map(([label, v]) => ({
      label,
      score: Math.round(v.score * 10) / 10,
      reason: `${v.n} roles · ${v.wins} strong signals`,
    }))
    .sort((a, b) => b.score - a.score);

  const leanInto = ranked.filter((r) => r.score > 0).slice(0, 6);
  const beCautious = ranked
    .filter((r) => r.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const gapThemes: GuidanceItem[] = [...gapScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, n]) => ({
      label,
      score: -n,
      reason: `Appears in ${n} application gap list(s)`,
    }));

  if (leanInto.length === 0 && jobs.length > 0) {
    leanInto.push({
      label: "multimedia + e-learning + instructional design",
      score: 1,
      reason: "Core intersection across your strongest scored roles",
    });
  }

  const topMatches = jobs
    .filter((j) => j.matchScore != null)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 8);

  const topPay = withPay
    .slice()
    .sort((a, b) => (b.annualMid ?? 0) - (a.annualMid ?? 0))
    .slice(0, 8);

  return {
    total: jobs.length,
    appliedThisWeek,
    interviewsOpen,
    responseRate,
    rejected: byStatus.rejected,
    withMatchScore: scored.length,
    avgMatchScore,
    abovePriorSalary,
    knownSalaryCount: withPay.length,
    avgAnnualMid,
    byStatus,
    statusChart,
    matchLevelChart,
    matchScoreChart,
    salaryVsPriorChart,
    timelineChart,
    topMatches,
    topPay,
    leanInto,
    beCautious,
    gapThemes,
  };
}
