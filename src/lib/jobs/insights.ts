import type { JobApplication, JobStatus } from "./types";

export type GuidanceItem = {
  label: string;
  reason: string;
  score: number;
};

export type Insights = {
  total: number;
  appliedThisWeek: number;
  interviewsOpen: number;
  responseRate: number;
  byStatus: Record<JobStatus, number>;
  leanInto: GuidanceItem[];
  beCautious: GuidanceItem[];
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

export function computeInsights(jobs: JobApplication[]): Insights {
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

  for (const job of jobs) {
    byStatus[job.status] += 1;
  }

  const appliedThisWeek = jobs.filter((j) => weeksAgo(j.dateApplied, 1)).length;
  const interviewsOpen = byStatus.screen + byStatus.interview;
  const decided = byStatus.offer + byStatus.rejected + byStatus.withdrawn + byStatus.interview + byStatus.screen;
  const started = jobs.filter((j) => j.status !== "researching" && j.status !== "avoid").length;
  const responseRate = started === 0 ? 0 : Math.round((decided / started) * 100);

  // Tag scoring: positive for interview/offer, negative for rejected/avoid
  const tagScores = new Map<string, { score: number; n: number; wins: number; losses: number }>();

  for (const job of jobs) {
    const tags = job.tags.length ? job.tags : [job.location || "untagged"].filter(Boolean);
    let delta = 0;
    if (job.status === "offer" || job.status === "interview") delta = 2;
    else if (job.status === "screen") delta = 1;
    else if (job.status === "rejected") delta = -2;
    else if (job.status === "avoid") delta = -3;
    else if (job.status === "applied") delta = 0;

    for (const tag of tags) {
      const key = tagKey(tag);
      if (!key) continue;
      const cur = tagScores.get(key) ?? { score: 0, n: 0, wins: 0, losses: 0 };
      cur.score += delta;
      cur.n += 1;
      if (delta > 0) cur.wins += 1;
      if (delta < 0) cur.losses += 1;
      tagScores.set(key, cur);
    }
  }

  const ranked = [...tagScores.entries()]
    .filter(([, v]) => v.n >= 1)
    .map(([label, v]) => ({
      label,
      score: v.score,
      reason:
        v.wins > v.losses
          ? `${v.wins} positive signal(s) across ${v.n} role(s)`
          : v.losses > v.wins
            ? `${v.losses} stall/reject/avoid signal(s) across ${v.n} role(s)`
            : `Mixed results across ${v.n} role(s)`,
    }))
    .sort((a, b) => b.score - a.score);

  const leanInto = ranked.filter((r) => r.score > 0).slice(0, 5);
  const beCautious = ranked
    .filter((r) => r.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  // Heuristic extras if thin data
  if (leanInto.length === 0 && jobs.length > 0) {
    leanInto.push({
      label: "instructional design / elearning",
      score: 1,
      reason: "Default lean-in from your core strengths until more outcomes land",
    });
  }

  return {
    total: jobs.length,
    appliedThisWeek,
    interviewsOpen,
    responseRate,
    byStatus,
    leanInto,
    beCautious,
  };
}
