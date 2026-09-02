import seed from "./tracker-seed.json";
import {
  extractTrackerMeta,
  parseTrackerPayload,
  type JobApplication,
  type TrackerMeta,
} from "./types";

export function loadSeedJobs(): JobApplication[] {
  return parseTrackerPayload(seed).jobs;
}

export function loadSeedMeta(): TrackerMeta {
  const meta = extractTrackerMeta(seed);
  const profile = seed.user_profile_for_matching;
  return {
    lastUpdated: meta?.lastUpdated || seed.tracker_metadata.last_updated,
    candidateName: meta?.candidateName || seed.tracker_metadata.user,
    location: meta?.location || profile.location,
    preferredEmployment: meta?.preferredEmployment || profile.preferred_work_type,
    lastSalary: meta?.lastSalary || profile.previous_salary,
    preferredTarget: meta?.preferredTarget || "Approximately $80K+ when possible",
    highValueTarget: meta?.highValueTarget || "$100K+ for strong senior/technical multimedia-ID roles",
    preferredWork: meta?.preferredWork?.length
      ? meta.preferredWork
      : profile.strongest_role_types,
    lessPreferred: meta?.lessPreferred ?? [],
    risks: meta?.risks ?? seed.tracking_rules_for_future_updates ?? [],
    strengths: meta?.strengths?.length ? meta.strengths : profile.strengths,
    targets: meta?.targets?.length
      ? meta.targets
      : seed.highest_priority_applications,
    datePolicy:
      meta?.datePolicy ||
      seed.tracker_metadata.important_instruction_for_next_ai ||
      "",
  };
}
