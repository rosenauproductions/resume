import seed from "./tracker-seed.json";
import {
  extractTrackerMeta,
  normalizeJob,
  type JobApplication,
  type TrackerMeta,
} from "./types";

const TARGETS = (seed.notable_current_targets ?? []).map((t) => t.company);

export function loadSeedJobs(): JobApplication[] {
  return seed.applications
    .map((row) => normalizeJob(row, TARGETS))
    .filter((j): j is JobApplication => Boolean(j))
    .map((j) => ({ ...j, updatedAt: new Date().toISOString() }));
}

export function loadSeedMeta(): TrackerMeta {
  const meta = extractTrackerMeta(seed);
  return {
    lastUpdated: meta?.lastUpdated || seed.last_updated,
    candidateName: meta?.candidateName || seed.candidate.name,
    location: meta?.location || seed.candidate.location,
    preferredEmployment:
      meta?.preferredEmployment || seed.candidate.preferred_employment_type,
    lastSalary: meta?.lastSalary || seed.candidate.last_salary,
    preferredTarget:
      meta?.preferredTarget || seed.career_strategy.salary_context.preferred_general_target,
    highValueTarget:
      meta?.highValueTarget || seed.career_strategy.salary_context.high_value_target,
    preferredWork: meta?.preferredWork || seed.career_strategy.preferred_work,
    lessPreferred: meta?.lessPreferred || seed.career_strategy.less_preferred,
    risks: meta?.risks || seed.important_application_risks,
    strengths: meta?.strengths || seed.professional_profile.strengths,
    targets: meta?.targets || seed.notable_current_targets,
  };
}
