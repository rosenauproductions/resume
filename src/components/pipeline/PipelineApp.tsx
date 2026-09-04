"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_COLUMNS,
  STATUS_LABELS,
  composeLocation,
  createEmptyJob,
  isPureWorkArrangementLabel,
  parseTrackerPayload,
  normalizeJob,
  normalizeWorkType,
  stripWorkArrangement,
  type JobApplication,
  type JobStatus,
  type TrackerMeta,
} from "@/lib/jobs/types";
import {
  MISSING_PROMPTS,
  computeAnnualMid,
  formatRateLabel,
  missingRequiredFields,
  type IngestFields,
  type RequiredIngestKey,
  type WorkType,
} from "@/lib/jobs/ingest-shared";
import { computeInsights } from "@/lib/jobs/insights";
import { loadSeedJobs, loadSeedMeta } from "@/lib/jobs/seed";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { BarChart, DonutChart, DismissiblePanel, StatCard, TimelineChart } from "./PipelineCharts";
import { TargetMap } from "./TargetMap";
import type { PipelineHomePanelId } from "@/lib/pipeline/home-panels";

type IngestStep = "paste" | "review";

const LOCAL_KEY = "pipeline-jobs-v4";
const META_KEY = "pipeline-meta-v4";
type ViewMode = "insights" | "board" | "list" | "visits" | "map";
type StorageMode = "local" | "blob" | "db";

type VisitRow = {
  id: string;
  occurredAt: string;
  path: string;
  city: string;
  region: string;
  country: string;
  device: string;
  sessionFingerprint: string;
  locationLabel: string;
  linkConfidence: string;
  linkReason: string;
  linkedApplicationId: string | null;
  linkedJob: { id: string; company: string; title: string; location: string } | null;
};

type VisitJobOption = { id: string; company: string; title: string; location: string };

const CHATGPT_PROMPT = `Export my job tracker as JSON with separate dates AND location for every job (from the posting only — never invent):

Dates:
- application_date / date_applied = when I actually submitted (or null)
- date_posting_shared_with_ChatGPT / dateDiscussed = when I showed ChatGPT the posting (never copy this into application_date)
- date_precision = exact | week_estimate | unknown

Location (required on every application; use posting text only):
- location = "City, ST" when onsite/hybrid is known (e.g. "Plano, TX"), or "Remote" when fully remote with no city
- location_city, location_state, location_country = structured parts when known (omit if unknown)
- work_type = remote | hybrid | onsite (from the posting; omit if unclear)
- employment_type = Full-time / Part-time / 1099 / etc. (separate from work_type)

Also include: company, role, status, salary, fit/fit_score, key_match_reasons, concerns, notes, interview fields.
Keep Transfr/Baylor as considering/not confirmed unless I explicitly say I applied.
Save/overwrite the Google Drive job-tracker.json, then use Load from Drive / Import Drive → DB in /pipeline.`;

function loadLocal(): JobApplication[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((j) => normalizeJob(j)).filter((j): j is JobApplication => Boolean(j));
  } catch {
    return [];
  }
}

function loadMetaLocal(): TrackerMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TrackerMeta;
  } catch {
    return null;
  }
}

function saveLocal(jobs: JobApplication[], meta: TrackerMeta | null) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(jobs));
  if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function jobKey(job: JobApplication) {
  return `${job.company}::${job.title}`.toLowerCase().trim();
}

function mergeJobs(a: JobApplication[], b: JobApplication[]) {
  const map = new Map<string, JobApplication>();
  for (const job of [...a, ...b]) {
    const key = jobKey(job);
    const prev = map.get(key);
    if (!prev || new Date(job.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) {
      map.set(key, { ...job, id: prev?.id || job.id || crypto.randomUUID() });
    }
  }
  return [...map.values()].sort((x, y) => {
    const dx = x.dateApplied || "";
    const dy = y.dateApplied || "";
    if (dx && dy) return dy.localeCompare(dx);
    if (dx) return -1;
    if (dy) return 1;
    return (y.matchScore ?? -1) - (x.matchScore ?? -1);
  });
}

function parseImport(text: string): { jobs: JobApplication[]; meta: Partial<TrackerMeta> | null } {
  const trimmed = text.trim();
  if (!trimmed) return { jobs: [], meta: null };
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const data = JSON.parse(candidate) as unknown;
  const { jobs, meta } = parseTrackerPayload(data);
  if (!jobs.length) throw new Error("No applications found in JSON.");
  return { jobs, meta };
}

function money(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function PipelineApp() {
  const [booting, setBooting] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [meta, setMeta] = useState<TrackerMeta | null>(null);
  const [view, setView] = useState<ViewMode>("insights");
  const mapScrollPending = useRef(false);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestStep, setIngestStep] = useState<IngestStep>("paste");
  const [ingestInput, setIngestInput] = useState("");
  const [ingestError, setIngestError] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMode, setIngestMode] = useState<"ai" | "heuristic" | "">("");
  const [ingestWarning, setIngestWarning] = useState("");
  const [ingestDraft, setIngestDraft] = useState<IngestFields | null>(null);
  const [ingestStatus, setIngestStatus] = useState<JobStatus>("researching");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [detail, setDetail] = useState<JobApplication | null>(null);
  const [saving, setSaving] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [visitJobs, setVisitJobs] = useState<VisitJobOption[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [thisDeviceId, setThisDeviceId] = useState("");
  const [visitorIdentifyEnabled, setVisitorIdentifyEnabled] = useState(false);
  const [skillsSectionEnabled, setSkillsSectionEnabled] = useState(false);
  const [dismissedPanels, setDismissedPanels] = useState<string[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const insights = useMemo(() => computeInsights(jobs, meta), [jobs, meta]);
  const isPanelVisible = useCallback(
    (id: PipelineHomePanelId | string) => !dismissedPanels.includes(id),
    [dismissedPanels],
  );
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.company.toLowerCase().includes(q) ||
        j.title.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.matchLevel.toLowerCase().includes(q) ||
        j.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [jobs, filter]);

  const persist = useCallback(async (next: JobApplication[], nextMeta: TrackerMeta | null = meta, mode: "replace" | "upsert" = "replace") => {
    setJobs(next);
    if (nextMeta) setMeta(nextMeta);
    saveLocal(next, nextMeta);
    setSaving(true);
    try {
      const res = await fetch("/api/pipeline/jobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: next, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStorageMode(data.storage === "db" ? "db" : data.storage === "blob" ? "blob" : "local");
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
      } else if (res.status === 501) {
        setStorageMode("local");
      }
    } catch {
      setStorageMode("local");
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(""), 2500);
    }
  }, [meta]);

  async function refreshVisits() {
    setVisitsLoading(true);
    try {
      const res = await fetch("/api/pipeline/visits");
      const data = await res.json();
      if (res.ok) {
        setVisits(data.visits ?? []);
        setVisitJobs(data.jobs ?? []);
      }
    } catch {
      // ignore
    } finally {
      setVisitsLoading(false);
    }
  }

  async function refreshSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/pipeline/settings");
      const data = await res.json();
      if (res.ok && data.settings) {
        setVisitorIdentifyEnabled(Boolean(data.settings.visitorIdentify?.enabled));
        setSkillsSectionEnabled(Boolean(data.settings.skillsSection?.enabled));
        setDismissedPanels(
          Array.isArray(data.settings.pipelineHome?.dismissedPanels)
            ? data.settings.pipelineHome.dismissedPanels
            : [],
        );
      }
    } catch {
      // ignore
    } finally {
      setSettingsLoading(false);
    }
  }

  async function patchSettings(body: Record<string, unknown>) {
    try {
      const res = await fetch("/api/pipeline/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Could not save setting");
        return;
      }
      if (data.settings) {
        setVisitorIdentifyEnabled(Boolean(data.settings.visitorIdentify?.enabled));
        setSkillsSectionEnabled(Boolean(data.settings.skillsSection?.enabled));
        setDismissedPanels(
          Array.isArray(data.settings.pipelineHome?.dismissedPanels)
            ? data.settings.pipelineHome.dismissedPanels
            : [],
        );
      }
    } catch {
      setNotice("Network error saving setting");
    }
  }

  function dismissHomePanel(panelId: string) {
    const next = [...new Set([...dismissedPanels, panelId])];
    setDismissedPanels(next);
    void patchSettings({ dismissedPanels: next });
  }

  function restoreHomePanels() {
    setDismissedPanels([]);
    void patchSettings({ restoreHomePanels: true });
  }

  function toggleVisitorIdentify(enabled: boolean) {
    setVisitorIdentifyEnabled(enabled);
    void patchSettings({ visitorIdentifyEnabled: enabled });
    setNotice(
      enabled
        ? "Return-visitor identify prompt enabled"
        : "Return-visitor identify prompt disabled",
    );
  }

  function toggleSkillsSection(enabled: boolean) {
    setSkillsSectionEnabled(enabled);
    void patchSettings({ skillsSectionEnabled: enabled });
    setNotice(
      enabled
        ? "Skills & tools section shown on resume"
        : "Skills & tools section hidden on resume",
    );
  }

  useEffect(() => {
    if (view !== "map" || !mapScrollPending.current) return;
    mapScrollPending.current = false;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("pipeline-target-map")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  async function importIntoDb(source: "drive" | "bundled" | "json", payload?: unknown, mode: "upsert" | "replace" = "upsert") {
    setSeedLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/pipeline/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, payload, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (source === "drive" && (res.status === 501 || res.status === 502)) {
          setNotice(data.error || "Drive unavailable — try Bundled fallback");
          return false;
        }
        setNotice(data.error || "Import failed");
        return false;
      }
      const nextJobs = (data.jobs ?? []) as JobApplication[];
      const nextMeta = (data.meta as TrackerMeta) ?? loadSeedMeta();
      setJobs(nextJobs);
      setMeta(nextMeta);
      saveLocal(nextJobs, nextMeta);
      setStorageMode("db");
      setNotice(`Imported ${nextJobs.length} applications into database (${mode})`);
      return true;
    } catch {
      setNotice("Network error during import");
      return false;
    } finally {
      setSeedLoading(false);
    }
  }

  async function hydrateFromBundledSeed() {
    const ok = await importIntoDb("bundled", undefined, "replace");
    if (!ok) {
      const seeded = loadSeedJobs();
      const seededMeta = loadSeedMeta();
      setJobs(seeded);
      setMeta(seededMeta);
      saveLocal(seeded, seededMeta);
      setNotice(`Loaded ${seeded.length} applications from bundled fallback (local only)`);
      void persist(seeded, seededMeta, "replace");
    }
  }

  async function hydrateFromDrive() {
    await importIntoDb("drive", undefined, "upsert");
  }

  async function loadFromServer() {
    const remote = await fetch("/api/pipeline/jobs").then((r) => r.json());
    if (remote.storage === "db" && Array.isArray(remote.jobs)) {
      setJobs(remote.jobs);
      setMeta(loadMetaLocal() ?? loadSeedMeta());
      saveLocal(remote.jobs, loadMetaLocal() ?? loadSeedMeta());
      setStorageMode("db");
      return remote.jobs.length as number;
    }
    if (remote.storage === "blob" && Array.isArray(remote.jobs) && remote.jobs.length) {
      const current = loadLocal();
      const merged = mergeJobs(current, remote.jobs);
      setJobs(merged);
      saveLocal(merged, loadMetaLocal() ?? loadSeedMeta());
      setStorageMode("blob");
      return merged.length;
    }
    const local = loadLocal();
    if (local.length) {
      setJobs(local);
      setMeta(loadMetaLocal() ?? loadSeedMeta());
      return local.length;
    }
    return 0;
  }

  useEffect(() => {
    setThisDeviceId(getOrCreateDeviceId());
    (async () => {
      try {
        const session = await fetch("/api/pipeline/session").then((r) => r.json());
        setConfigured(Boolean(session.configured));
        if (!session.authenticated) {
          setAuthed(false);
          setBooting(false);
          return;
        }
        setAuthed(true);
        const count = await loadFromServer();
        if (!count) {
          setMeta(loadSeedMeta());
          setNotice("Database empty — Load from Drive or Bundled fallback to import applications");
        }
        void refreshVisits();
        void refreshSettings();
      } catch {
        setAuthed(false);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/pipeline/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAuthError(data.error || "Login failed");
      return;
    }
    setPassword("");
    setAuthed(true);
    const count = await loadFromServer();
    if (!count) {
      setMeta(loadSeedMeta());
      setNotice("Database empty — Load from Drive or Bundled fallback to import applications");
    }
    void refreshVisits();
    void refreshSettings();
  }

  async function handleLogout() {
    await fetch("/api/pipeline/logout", { method: "POST" });
    setAuthed(false);
    setJobs([]);
  }

  function openNew() {
    setEditing(createEmptyJob({ status: "applied" }));
    setFormOpen(true);
  }

  function openEdit(job: JobApplication) {
    setEditing({ ...job });
    setFormOpen(true);
    setDetail(null);
  }

  function resetIngest() {
    setIngestStep("paste");
    setIngestInput("");
    setIngestError("");
    setIngestLoading(false);
    setIngestMode("");
    setIngestWarning("");
    setIngestDraft(null);
    setIngestStatus("researching");
  }

  function openIngest() {
    resetIngest();
    setIngestOpen(true);
  }

  function setIngestField<K extends keyof IngestFields>(key: K, value: IngestFields[K]) {
    setIngestDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function runIngest() {
    const input = ingestInput.trim();
    if (!input) {
      setIngestError("Paste a job posting URL or the full description text.");
      return;
    }
    setIngestLoading(true);
    setIngestError("");
    setIngestWarning("");
    try {
      const res = await fetch("/api/pipeline/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIngestError(data.error || "Ingest failed");
        return;
      }
      const fields = (data.fields ?? data.job ?? {}) as IngestFields;
      const workType = (normalizeWorkType(fields.workType) ||
        normalizeWorkType(fields.location) ||
        "") as WorkType;
      setIngestDraft({
        company: fields.company || "",
        title: fields.title || "",
        location: fields.location || "",
        workType,
        url: fields.url || "",
        description: fields.description || "",
        rate: fields.rate || "",
        salaryMin: fields.salaryMin ?? null,
        salaryMax: fields.salaryMax ?? null,
        salaryPeriod: fields.salaryPeriod || "",
        employmentType: fields.employmentType || "",
        source: fields.source || "",
        dateApplied: fields.dateApplied || "",
        dateDiscussed: fields.dateDiscussed || "",
      });
      setIngestMode(data.mode === "ai" ? "ai" : "heuristic");
      setIngestWarning(typeof data.fetchWarning === "string" ? data.fetchWarning : "");
      setIngestStatus("researching");
      setIngestStep("review");
    } catch {
      setIngestError("Network error during ingest");
    } finally {
      setIngestLoading(false);
    }
  }

  function saveIngestDraft() {
    if (!ingestDraft) return;
    const missing = missingRequiredFields(ingestDraft);
    if (missing.length) {
      setIngestError(`Still needed: ${missing.map((k) => MISSING_PROMPTS[k]).join(" · ")}`);
      return;
    }
    const workType =
      ingestDraft.workType || normalizeWorkType(ingestDraft.location) || "";
    const location =
      composeLocation({
        location: ingestDraft.location.trim(),
        workType,
      }) || ingestDraft.location.trim();
    const salaryPeriod = ingestDraft.salaryPeriod;
    const rate =
      ingestDraft.rate.trim() ||
      formatRateLabel(ingestDraft.salaryMin, ingestDraft.salaryMax, salaryPeriod);
    const employmentRaw = ingestDraft.employmentType.trim();
    const employmentType = isPureWorkArrangementLabel(employmentRaw)
      ? ""
      : employmentRaw;
    const nextJob = createEmptyJob({
      company: ingestDraft.company.trim(),
      title: ingestDraft.title.trim(),
      shortName: ingestDraft.company.trim().slice(0, 24),
      location,
      url: ingestDraft.url.trim(),
      description: ingestDraft.description.trim(),
      rate,
      salaryMin: ingestDraft.salaryMin,
      salaryMax: ingestDraft.salaryMax,
      salaryPeriod,
      annualMid: computeAnnualMid(
        ingestDraft.salaryMin,
        ingestDraft.salaryMax,
        salaryPeriod,
      ),
      employmentType,
      source: ingestDraft.source.trim(),
      status: ingestStatus,
      dateApplied: ingestDraft.dateApplied || "",
      dateDiscussed: ingestDraft.dateDiscussed || "",
      datePrecision: ingestDraft.dateApplied ? "exact" : "unknown",
    });
    void persist([nextJob, ...jobs], meta, "upsert");
    setIngestOpen(false);
    resetIngest();
    setDetail(nextJob);
    setNotice("Saved application with description + URL");
  }

  function saveForm() {
    if (!editing) return;
    const nextJob = { ...editing, updatedAt: new Date().toISOString() };
    const idx = jobs.findIndex((j) => j.id === nextJob.id);
    const next = idx >= 0 ? jobs.map((j) => (j.id === nextJob.id ? nextJob : j)) : [nextJob, ...jobs];
    void persist(next);
    setFormOpen(false);
    setEditing(null);
    setNotice("Saved");
  }

  async function deleteJob(id: string) {
    if (!confirm("Delete this application?")) return;
    try {
      const res = await fetch(`/api/pipeline/jobs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        const next = jobs.filter((j) => j.id !== id);
        setJobs(next);
        saveLocal(next, meta);
        setStorageMode("db");
      } else {
        void persist(jobs.filter((j) => j.id !== id));
      }
    } catch {
      void persist(jobs.filter((j) => j.id !== id));
    }
    setDetail(null);
    setFormOpen(false);
  }

  function updateStatus(id: string, status: JobStatus) {
    void persist(
      jobs.map((j) => (j.id === id ? { ...j, status, updatedAt: new Date().toISOString() } : j)),
    );
  }

  async function applyImport(mode: "merge" | "replace") {
    setImportError("");
    try {
      const { jobs: incoming, meta: incomingMeta } = parseImport(importText);
      if (!incoming.length) {
        setImportError("No jobs found in paste.");
        return;
      }
      const nextMeta: TrackerMeta = {
        ...loadSeedMeta(),
        ...meta,
        ...incomingMeta,
        targets: incomingMeta?.targets?.length ? incomingMeta.targets : meta?.targets ?? loadSeedMeta().targets,
        strengths: incomingMeta?.strengths?.length
          ? incomingMeta.strengths
          : meta?.strengths ?? loadSeedMeta().strengths,
        risks: incomingMeta?.risks?.length ? incomingMeta.risks : meta?.risks ?? loadSeedMeta().risks,
      };
      const ok = await importIntoDb(
        "json",
        JSON.parse(
          (importText.trim().match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? importText).trim(),
        ),
        mode === "replace" ? "replace" : "upsert",
      );
      if (!ok) {
        const stamped = incoming.map((j) => ({ ...j, updatedAt: new Date().toISOString() }));
        const next = mode === "replace" ? stamped : mergeJobs(jobs, stamped);
        void persist(next, nextMeta, mode === "replace" ? "replace" : "upsert");
      } else if (incomingMeta) {
        setMeta(nextMeta);
        saveLocal(jobs, nextMeta);
      }
      setImportOpen(false);
      setImportText("");
      setView("insights");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function handleVisitAction(
    visitId: string,
    action: "confirm" | "ignore" | "link",
    applicationId?: string,
  ) {
    const res = await fetch("/api/pipeline/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitId, action, applicationId }),
    });
    if (res.ok) {
      setNotice(action === "ignore" ? "Visit ignored" : "Visit linked");
      void refreshVisits();
      const remote = await fetch("/api/pipeline/jobs").then((r) => r.json());
      if (Array.isArray(remote.jobs)) setJobs(remote.jobs);
    } else {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Visit action failed");
    }
  }

  async function handleIgnoreDevice(deviceId: string, visitId?: string) {
    const id = deviceId.trim();
    if (!id) {
      setNotice("No device ID to ignore");
      return;
    }
    const res = await fetch("/api/pipeline/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ignore-device",
        deviceId: id,
        visitId,
        note: visitId ? "Ignored from Visits tab" : "Ignored this browser",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setNotice(
        data.ignoredDevice?.created === false
          ? "Device already on ignore list"
          : "Device added to ignore list — future visits skip ntfy/Discord",
      );
      void refreshVisits();
      setTimeout(() => setNotice(""), 3500);
    } else {
      setNotice(data.error || "Ignore device failed");
    }
  }

  async function handleDeleteVisit(visitId: string) {
    if (!window.confirm("Permanently delete this visit from the database?")) return;
    const res = await fetch(`/api/pipeline/visits?id=${encodeURIComponent(visitId)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setVisits((prev) => prev.filter((v) => v.id !== visitId));
      setNotice("Visit deleted");
      setTimeout(() => setNotice(""), 2500);
    } else {
      setNotice(data.error || "Delete failed");
    }
  }

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--ink)] text-[var(--muted)]">
        Loading pipeline…
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--ink)] px-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[var(--panel)] p-8">
          <p className="section-kicker">Pipeline</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--cream)]">
            Not configured
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Set <code className="text-[var(--accent)]">JOB_TRACKER_SECRET</code> in Vercel env vars.
          </p>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[var(--ink)]">
        <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
          <p className="section-kicker">Private</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--cream)]">
            Pipeline
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Password-gated job tracker with match scores, salary trends, and outcome charts.
          </p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <label className="block text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Password
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-base text-[var(--cream)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            {authError ? <p className="text-sm text-red-300">{authError}</p> : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--ink)]"
            >
              Enter
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ink)] text-[var(--cream)]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--ink)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent)]">
              Private · updated {meta?.lastUpdated || "—"}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
              Pipeline
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]">
              {storageMode === "db" ? "Neon DB" : storageMode === "blob" ? "Synced" : "Browser storage"}
              {saving ? " · saving…" : ""}
            </span>
            <button
              type="button"
              onClick={() => void hydrateFromDrive()}
              disabled={seedLoading}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:border-[var(--accent)] disabled:opacity-50"
            >
              {seedLoading ? "Importing…" : "Import Drive → DB"}
            </button>
            <button
              type="button"
              onClick={() => void hydrateFromBundledSeed()}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[var(--muted)] hover:border-white/30 hover:text-[var(--cream)]"
              title="Import the JSON baked into the site into the database"
            >
              Import bundled
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:border-[var(--accent)]"
            >
              Import
            </button>
            <button
              type="button"
              onClick={openIngest}
              className="rounded-lg border border-[var(--accent)]/40 px-3 py-1.5 text-sm text-[var(--accent)] hover:border-[var(--accent)]"
            >
              Ingest JD
            </button>
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)]"
            >
              Add job
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--cream)]"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {notice ? (
          <p className="mb-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
            {notice}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--cream)]">
            <input
              type="checkbox"
              checked={visitorIdentifyEnabled}
              disabled={settingsLoading}
              onChange={(e) => toggleVisitorIdentify(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Ask return visitors to identify (company / position)
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--cream)]">
            <input
              type="checkbox"
              checked={skillsSectionEnabled}
              disabled={settingsLoading}
              onChange={(e) => toggleSkillsSection(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Show Skills &amp; tools on resume
          </label>
          {dismissedPanels.length ? (
            <button
              type="button"
              onClick={restoreHomePanels}
              className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--cream)]"
            >
              Restore home panels ({dismissedPanels.length} hidden)
            </button>
          ) : (
            <span className="ml-auto text-xs text-[var(--muted)]">
              Home panels: click × to hide (saved)
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isPanelVisible("stat-applications") ? (
            <StatCard
              label="Applications"
              value={String(insights.total)}
              hint={`${insights.appliedThisWeek} dated this week`}
              onDismiss={() => dismissHomePanel("stat-applications")}
            />
          ) : null}
          {isPanelVisible("stat-avg-match") ? (
            <StatCard
              label="Avg match"
              value={insights.avgMatchScore != null ? `${insights.avgMatchScore}/10` : "—"}
              hint={`${insights.withMatchScore} scored roles`}
              onDismiss={() => dismissHomePanel("stat-avg-match")}
            />
          ) : null}
          {isPanelVisible("stat-interviews") ? (
            <StatCard
              label="Interviews open"
              value={String(insights.interviewsOpen)}
              hint={`${insights.rejected} rejected`}
              onDismiss={() => dismissHomePanel("stat-interviews")}
            />
          ) : null}
          {isPanelVisible("stat-avg-pay") ? (
            <StatCard
              label="Avg known pay"
              value={money(insights.avgAnnualMid)}
              hint={`${insights.abovePriorSalary}/${insights.knownSalaryCount} ≥ prior ${money(meta?.lastSalary)}`}
              onDismiss={() => dismissHomePanel("stat-avg-pay")}
            />
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              ["insights", "Charts & trends"],
              ["board", "Board"],
              ["list", "All applications"],
              ["visits", "Visits"],
              ["map", "Target map"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === "map") mapScrollPending.current = true;
                setView(id);
                if (id === "visits" || id === "map") void refreshVisits();
              }}
              className={`rounded-full px-4 py-1.5 text-sm ${
                view === id
                  ? "bg-[var(--cream)] text-[var(--ink)]"
                  : "border border-white/15 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {label}
            </button>
          ))}
          {view === "list" ? (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter company, role, match…"
              className="ml-auto min-w-[14rem] rounded-full border border-white/15 bg-black/20 px-4 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
            />
          ) : (
            <span className="ml-auto self-center text-xs text-[var(--muted)]">
              Prior salary {money(meta?.lastSalary)} · W2 preferred · ntfy + DB dual-track
            </span>
          )}
        </div>

        <div className="mt-6">
          {view === "insights" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {isPanelVisible("chart-status") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("chart-status")}>
                    <DonutChart
                      title="Pipeline mix"
                      subtitle="Status across all applications"
                      data={insights.statusChart}
                    />
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("chart-match-bands") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("chart-match-bands")}>
                    <BarChart
                      title="Match score bands"
                      subtitle="Where your scored applications land"
                      data={insights.matchScoreChart}
                    />
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("chart-match-levels") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("chart-match-levels")}>
                    <BarChart
                      title="Match level mix"
                      subtitle="Excellent / Very Good / Good / Unknown"
                      data={insights.matchLevelChart}
                    />
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("chart-timeline") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("chart-timeline")}>
                    <TimelineChart data={insights.timelineChart} />
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("chart-salary") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("chart-salary")}>
                    <BarChart
                      title="Salary vs prior ($79K)"
                      subtitle="Annualized midpoint where known · teal ≥ prior"
                      data={insights.salaryVsPriorChart}
                      formatValue={(n) => `$${Math.round(n / 1000)}k`}
                    />
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("panel-targets") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("panel-targets")}>
                    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 pr-10">
                      <h3 className="font-[family-name:var(--font-display)] text-xl">Current targets</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">High-priority companies from the tracker</p>
                      <ul className="mt-4 space-y-2">
                        {(meta?.targets ?? []).map((t) => (
                          <li key={t.company} className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-2 text-sm">
                            <strong className="text-[var(--accent)]">{t.company}</strong>
                            <span className="text-[var(--muted)]"> — {t.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </DismissiblePanel>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {isPanelVisible("panel-lean-into") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("panel-lean-into")}>
                    <GuidanceCard title="Lean into" tone="good" items={insights.leanInto} />
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("panel-watch-gaps") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("panel-watch-gaps")}>
                    <GuidanceCard title="Watch gaps" tone="warn" items={insights.gapThemes} />
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("panel-date-policy") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("panel-date-policy")}>
                    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 pr-10">
                      <h3 className="font-[family-name:var(--font-display)] text-xl">Date policy</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                        {meta?.datePolicy ||
                          "Keep application_date separate from when a posting was shared with ChatGPT. Never invent dates."}
                      </p>
                      <p className="mt-3 text-xs text-[var(--warm)]">
                        Transfr + Baylor stay in Researching until you confirm “I applied.”
                      </p>
                    </section>
                  </DismissiblePanel>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {isPanelVisible("panel-strategy") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("panel-strategy")}>
                    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 pr-10">
                      <h3 className="font-[family-name:var(--font-display)] text-xl">Strategy</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">{meta?.preferredEmployment}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Prefer</p>
                      <p className="mt-1 text-sm text-[var(--cream)]/90">
                        {(meta?.preferredWork ?? []).slice(0, 5).join(" · ")}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--warm)]">Less preferred</p>
                      <p className="mt-1 text-sm text-[var(--cream)]/90">
                        {(meta?.lessPreferred ?? []).slice(0, 4).join(" · ") || "Facilitation-heavy, travel-heavy, low-comp roles"}
                      </p>
                      <p className="mt-4 text-sm text-[var(--muted)]">
                        Target {meta?.preferredTarget || "~$80K+"} · stretch {meta?.highValueTarget || "$100K+"}
                      </p>
                    </section>
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("panel-exact-dates") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("panel-exact-dates")}>
                    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 pr-10">
                      <h3 className="font-[family-name:var(--font-display)] text-xl">Exact dates only</h3>
                      <ul className="mt-4 space-y-2 text-sm">
                        {jobs
                          .filter((j) => j.dateApplied && j.datePrecision === "exact")
                          .sort((a, b) => b.dateApplied.localeCompare(a.dateApplied))
                          .map((j) => (
                            <li key={j.id} className="flex justify-between gap-3 border-b border-white/5 pb-2">
                              <span>
                                <span className="font-medium">{j.shortName || j.company}</span>
                                <span className="block text-xs text-[var(--muted)]">{j.title}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-[var(--accent)]">{j.dateApplied}</span>
                            </li>
                          ))}
                      </ul>
                    </section>
                  </DismissiblePanel>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {isPanelVisible("panel-top-matches") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("panel-top-matches")}>
                    <RankList
                      title="Top match scores"
                      jobs={insights.topMatches}
                      onSelect={setDetail}
                      primary={(j) => (j.matchScore != null ? `${j.matchScore}/10` : "—")}
                    />
                  </DismissiblePanel>
                ) : null}
                {isPanelVisible("panel-top-pay") ? (
                  <DismissiblePanel onDismiss={() => dismissHomePanel("panel-top-pay")}>
                    <RankList
                      title="Highest known pay"
                      jobs={insights.topPay}
                      onSelect={setDetail}
                      primary={(j) => money(j.annualMid)}
                    />
                  </DismissiblePanel>
                ) : null}
              </div>

              {(meta?.risks?.length || meta?.strengths?.length) ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {meta?.strengths?.length && isPanelVisible("panel-strengths") ? (
                    <DismissiblePanel onDismiss={() => dismissHomePanel("panel-strengths")}>
                      <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 pr-10">
                        <h3 className="font-[family-name:var(--font-display)] text-xl">Profile strengths</h3>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(meta?.strengths ?? []).map((s) => (
                            <span key={s} className="rounded-full border border-white/15 px-3 py-1 text-xs text-[var(--cream)]/85">
                              {s}
                            </span>
                          ))}
                        </div>
                      </section>
                    </DismissiblePanel>
                  ) : null}
                  {meta?.risks?.length && isPanelVisible("panel-risks") ? (
                    <DismissiblePanel onDismiss={() => dismissHomePanel("panel-risks")}>
                      <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 pr-10">
                        <h3 className="font-[family-name:var(--font-display)] text-xl">Application risks</h3>
                        <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                          {(meta?.risks ?? []).map((r) => (
                            <li key={r.slice(0, 40)} className="border-l border-[var(--warm)]/40 pl-3">
                              {r}
                            </li>
                          ))}
                        </ul>
                      </section>
                    </DismissiblePanel>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {view === "board" ? (
            <Board jobs={jobs} onSelect={setDetail} onStatus={updateStatus} />
          ) : null}

          {view === "list" ? (
            <ApplicationTable jobs={filtered} onSelect={setDetail} prior={meta?.lastSalary ?? 79000} />
          ) : null}

          {view === "visits" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[var(--muted)]">
                  Detailed visit log (ntfy still pings your phone). Unique city matches auto-suggest a job — confirm or ignore.
                </p>
                <button
                  type="button"
                  onClick={() => void refreshVisits()}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:border-[var(--accent)]"
                >
                  {visitsLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {thisDeviceId ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs text-[var(--muted)]">
                    This browser&apos;s device ID (not a MAC — browsers can&apos;t expose those). Ignore it
                    here to skip ntfy/Discord without redeploying (also works via{" "}
                    <code className="text-[var(--cream)]">VISIT_IGNORE_DEVICE_IDS</code>).
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="break-all rounded-md border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-xs text-[var(--cream)]">
                      {thisDeviceId}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(thisDeviceId).then(() => {
                          setNotice("Device ID copied");
                          setTimeout(() => setNotice(""), 2000);
                        });
                      }}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleIgnoreDevice(thisDeviceId)}
                      className="rounded-lg border border-[var(--accent)]/40 px-3 py-1.5 text-xs text-[var(--accent)] hover:border-[var(--accent)]"
                    >
                      Ignore this browser
                    </button>
                  </div>
                </div>
              ) : null}
              {!visits.length ? (
                <p className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-[var(--muted)]">
                  No visits stored yet. They appear when someone opens the live resume.
                </p>
              ) : (
                <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                  {visits.map((v) => (
                    <li key={v.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-[family-name:var(--font-display)] text-[var(--cream)]">
                          {v.locationLabel}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {new Date(v.occurredAt).toLocaleString("en-US", {
                            timeZone: "America/Chicago",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}{" "}
                          CT · {v.device || "Unknown"} · {v.path}
                        </p>
                        {v.linkConfidence === "suggested" || v.linkConfidence === "confirmed" ? (
                          <p className="text-sm text-[var(--accent)]">
                            {v.linkConfidence === "suggested" ? "Suggested: " : "Linked: "}
                            {v.linkedJob
                              ? `${v.linkedJob.company} — ${v.linkedJob.title}`
                              : v.linkReason || "job"}
                          </p>
                        ) : v.linkReason ? (
                          <p className="text-xs text-[var(--muted)]">{v.linkReason}</p>
                        ) : (
                          <p className="text-xs text-[var(--muted)]">No auto-match</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {v.linkConfidence === "suggested" && v.linkedApplicationId ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleVisitAction(v.id, "confirm")}
                              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleVisitAction(v.id, "ignore")}
                              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs"
                            >
                              Ignore
                            </button>
                          </>
                        ) : null}
                        {v.linkConfidence === "none" || v.linkConfidence === "ignored" ? (
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const id = e.target.value;
                              if (!id) return;
                              void handleVisitAction(v.id, "link", id);
                              e.target.value = "";
                            }}
                            className="max-w-[14rem] rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs outline-none"
                          >
                            <option value="">Link to job…</option>
                            {visitJobs.map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.company} — {j.title}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {v.linkConfidence === "confirmed" ? (
                          <button
                            type="button"
                            onClick={() => void handleVisitAction(v.id, "ignore")}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-[var(--muted)]"
                          >
                            Unlink
                          </button>
                        ) : null}
                        {v.sessionFingerprint ? (
                          <button
                            type="button"
                            onClick={() => void handleIgnoreDevice(v.sessionFingerprint, v.id)}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                            title={`Ignore device ${v.sessionFingerprint}`}
                          >
                            Ignore device
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleDeleteVisit(v.id)}
                          className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs text-red-300/90 hover:border-red-400/60"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {view === "map" ? (
            <TargetMap
              jobs={jobs}
              visits={visits}
              onSelectJob={setDetail}
              loading={visitsLoading}
              onRefresh={() => void refreshVisits()}
            />
          ) : null}
        </div>
      </div>

      {detail ? (
        <Drawer onClose={() => setDetail(null)} title={`${detail.title} · ${detail.company}`}>
          <div className="space-y-3 text-sm">
            <MetaRow label="Status" value={`${STATUS_LABELS[detail.status]}${detail.statusRaw ? ` (${detail.statusRaw})` : ""}`} />
            <MetaRow label="Match" value={detail.matchScore != null ? `${detail.matchScore}/10 · ${detail.matchLevel || "—"}` : detail.matchLevel || "—"} />
            <MetaRow
              label="Applied"
              value={
                detail.dateApplied
                  ? `${detail.dateApplied}${detail.datePrecision ? ` (${detail.datePrecision})` : ""}`
                  : detail.datePrecision === "unknown"
                    ? "Unknown"
                    : "—"
              }
            />
            {detail.dateDiscussed ? (
              <MetaRow label="Shared w/ AI" value={detail.dateDiscussed} />
            ) : null}
            <MetaRow label="Pay" value={detail.rate || money(detail.annualMid)} />
            <MetaRow label="Employment" value={detail.employmentType || "—"} />
            <MetaRow label="Source" value={detail.source || "—"} />
            {detail.userInterest ? <MetaRow label="Interest" value={detail.userInterest} /> : null}
            <MetaRow label="Location" value={detail.location || "—"} />
            {detail.url ? (
              <div className="flex gap-3 border-b border-white/5 pb-2">
                <span className="w-24 shrink-0 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">URL</span>
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  {detail.url}
                </a>
              </div>
            ) : (
              <MetaRow label="URL" value="—" />
            )}
            {detail.interviewDate ? (
              <MetaRow label="Interview" value={`${detail.interviewDate}${detail.interviewNotes ? ` · ${detail.interviewNotes}` : ""}`} />
            ) : null}
            {detail.isTarget ? <MetaRow label="Target" value="Yes — current priority" /> : null}
            {detail.strongMatches.length ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Strong matches</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detail.strongMatches.map((t) => (
                    <span key={t} className="rounded-full border border-[var(--accent)]/30 px-2.5 py-1 text-[11px] text-[var(--accent)]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {detail.gaps.length ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Gaps</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detail.gaps.map((t) => (
                    <span key={t} className="rounded-full border border-[var(--warm)]/30 px-2.5 py-1 text-[11px] text-[var(--warm)]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Description</p>
              <p className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap text-[var(--cream)]/90">
                {detail.description || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--cream)]/90">{detail.notes || "—"}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => openEdit(detail)} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                Edit
              </button>
              <button type="button" onClick={() => deleteJob(detail.id)} className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-300">
                Delete
              </button>
            </div>
          </div>
        </Drawer>
      ) : null}

      {formOpen && editing ? (
        <Drawer
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          title={jobs.some((j) => j.id === editing.id) ? "Edit application" : "Add application"}
        >
          <JobForm job={editing} onChange={setEditing} onSave={saveForm} onDelete={() => deleteJob(editing.id)} />
        </Drawer>
      ) : null}

      {importOpen ? (
        <Drawer onClose={() => setImportOpen(false)} title="Import tracker JSON">
          <div className="space-y-4 text-sm">
            <p className="text-[var(--muted)]">Paste a full `job_application_tracker` export (or applications array).</p>
            <pre className="max-h-36 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs whitespace-pre-wrap text-[var(--cream)]/90">
              {CHATGPT_PROMPT}
            </pre>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs outline-none focus:border-[var(--accent)]"
            />
            {importError ? <p className="text-red-300">{importError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => applyImport("replace")} className="rounded-lg bg-[var(--accent)] px-3 py-2 font-semibold text-[var(--ink)]">
                Replace all
              </button>
              <button type="button" onClick={() => applyImport("merge")} className="rounded-lg border border-white/20 px-3 py-2">
                Merge
              </button>
            </div>
          </div>
        </Drawer>
      ) : null}

      {ingestOpen ? (
        <Drawer
          onClose={() => {
            setIngestOpen(false);
            resetIngest();
          }}
          title={ingestStep === "paste" ? "Ingest job description" : "Review & complete"}
        >
          {ingestStep === "paste" ? (
            <div className="space-y-4 text-sm">
              <p className="text-[var(--muted)]">
                Paste a posting URL or the full job description. We extract description, pay range, work arrangement, hours, company, title, and location — then ask only for anything still missing. LinkedIn/Workday often block scraping; paste text there and keep the URL.
              </p>
              <textarea
                value={ingestInput}
                onChange={(e) => setIngestInput(e.target.value)}
                rows={14}
                placeholder={"https://…\n\nor paste the full job posting text here"}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs outline-none focus:border-[var(--accent)]"
              />
              {ingestError ? <p className="text-red-300">{ingestError}</p> : null}
              <button
                type="button"
                disabled={ingestLoading}
                onClick={() => void runIngest()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--ink)] disabled:opacity-50"
              >
                {ingestLoading ? "Sorting…" : "Sort & extract"}
              </button>
            </div>
          ) : ingestDraft ? (
            <IngestReviewForm
              draft={ingestDraft}
              status={ingestStatus}
              mode={ingestMode}
              warning={ingestWarning}
              error={ingestError}
              onField={setIngestField}
              onStatus={setIngestStatus}
              onBack={() => {
                setIngestStep("paste");
                setIngestError("");
              }}
              onSave={saveIngestDraft}
            />
          ) : null}
        </Drawer>
      ) : null}
    </main>
  );
}

function GuidanceCard({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "good" | "warn";
  items: { label: string; reason: string }[];
}) {
  const color = tone === "good" ? "var(--accent)" : "var(--warm)";
  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 pr-10">
      <h3 className="font-[family-name:var(--font-display)] text-xl" style={{ color }}>
        {title}
      </h3>
      <ul className="mt-4 space-y-2">
        {items.length ? (
          items.map((item) => (
            <li key={item.label} className="rounded-lg border border-white/10 px-3 py-2">
              <p className="font-medium capitalize">{item.label}</p>
              <p className="text-xs text-[var(--muted)]">{item.reason}</p>
            </li>
          ))
        ) : (
          <li className="text-xs text-[var(--muted)]">Not enough signal yet</li>
        )}
      </ul>
    </section>
  );
}

function RankList({
  title,
  jobs,
  onSelect,
  primary,
}: {
  title: string;
  jobs: JobApplication[];
  onSelect: (job: JobApplication) => void;
  primary: (job: JobApplication) => string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 pr-10">
      <h3 className="font-[family-name:var(--font-display)] text-xl">{title}</h3>
      <ul className="mt-4 space-y-2">
        {jobs.map((job) => (
          <li key={job.id}>
            <button
              type="button"
              onClick={() => onSelect(job)}
              className="flex w-full items-baseline justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-left hover:border-[var(--accent)]/40"
            >
              <span>
                <span className="block text-sm font-medium">{job.company}</span>
                <span className="text-xs text-[var(--muted)]">{job.title}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-[var(--accent)]">{primary(job)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-white/5 pb-2">
      <span className="w-24 shrink-0 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-sm">
      <button type="button" className="h-full flex-1" aria-label="Close" onClick={onClose} />
      <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[var(--panel)] p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl leading-tight">{title}</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--cream)]">
            Close
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function Board({
  jobs,
  onSelect,
  onStatus,
}: {
  jobs: JobApplication[];
  onSelect: (job: JobApplication) => void;
  onStatus: (id: string, status: JobStatus) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {BOARD_COLUMNS.map((status) => {
        const col = jobs.filter((j) => j.status === status);
        return (
          <section
            key={status}
            className="w-64 shrink-0 rounded-2xl border border-white/10 bg-[var(--panel)]/80"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/job-id");
              if (id) onStatus(id, status);
            }}
          >
            <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <h3 className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {STATUS_LABELS[status]}
              </h3>
              <span className="text-xs text-[var(--accent)]">{col.length}</span>
            </header>
            <div className="space-y-2 p-2">
              {col.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/job-id", job.id)}
                  onClick={() => onSelect(job)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-[var(--accent)]/50"
                >
                  <p className="text-sm font-medium">{job.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{job.company}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    {job.matchScore != null ? (
                      <span className="text-[var(--accent)]">{job.matchScore}/10</span>
                    ) : null}
                    {job.isTarget ? <span className="text-[var(--warm)]">Target</span> : null}
                    {job.rate ? <span className="text-[var(--muted)]">{job.rate}</span> : null}
                  </div>
                </button>
              ))}
              {!col.length ? (
                <p className="px-2 py-6 text-center text-xs text-[var(--muted)]/70">Empty</p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ApplicationTable({
  jobs,
  onSelect,
  prior,
}: {
  jobs: JobApplication[];
  onSelect: (job: JobApplication) => void;
  prior: number;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-white/10 bg-[var(--panel)] text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-3">Company</th>
            <th className="px-3 py-3">Role</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Match</th>
            <th className="px-3 py-3">Pay</th>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Precision</th>
            <th className="px-3 py-3">Location</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              onClick={() => onSelect(job)}
              className="cursor-pointer border-b border-white/5 hover:bg-white/5"
            >
              <td className="px-3 py-3">
                <span className="font-medium">{job.shortName || job.company}</span>
                {job.isTarget ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--warm)]">Target</span>
                ) : null}
              </td>
              <td className="max-w-[16rem] truncate px-3 py-3 text-[var(--muted)]">{job.title}</td>
              <td className="px-3 py-3">{STATUS_LABELS[job.status]}</td>
              <td className="px-3 py-3 tabular-nums">
                {job.matchScore != null ? `${job.matchScore}/10` : "—"}
              </td>
              <td className="px-3 py-3 tabular-nums">
                <span className={job.annualMid != null && job.annualMid >= prior ? "text-[var(--accent)]" : ""}>
                  {job.rate || money(job.annualMid)}
                </span>
              </td>
              <td className="px-3 py-3 text-[var(--muted)]">{job.dateApplied || "—"}</td>
              <td className="px-3 py-3 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                {job.datePrecision || "—"}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-3 text-[var(--muted)]">{job.location || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!jobs.length ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">No matching applications</p>
      ) : null}
    </div>
  );
}

function IngestReviewForm({
  draft,
  status,
  mode,
  warning,
  error,
  onField,
  onStatus,
  onBack,
  onSave,
}: {
  draft: IngestFields;
  status: JobStatus;
  mode: "ai" | "heuristic" | "";
  warning: string;
  error: string;
  onField: <K extends keyof IngestFields>(key: K, value: IngestFields[K]) => void;
  onStatus: (status: JobStatus) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const missing = missingRequiredFields(draft);
  const missingSet = new Set<RequiredIngestKey>(missing);
  const field =
    "mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]";
  const needed =
    "mt-1.5 w-full rounded-xl border border-[var(--warm)]/50 bg-[var(--warm)]/5 px-3 py-2.5 outline-none focus:border-[var(--warm)]";

  function labelFor(key: RequiredIngestKey, filledLabel: string) {
    return missingSet.has(key) ? MISSING_PROMPTS[key] : filledLabel;
  }

  return (
    <form
      className="space-y-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span className="rounded-full border border-white/15 px-2.5 py-1">
          {mode === "ai" ? "AI extract" : "Heuristic extract"}
        </span>
        {missing.length ? (
          <span className="rounded-full border border-[var(--warm)]/40 px-2.5 py-1 text-[var(--warm)]">
            {missing.length} field{missing.length === 1 ? "" : "s"} still needed
          </span>
        ) : (
          <span className="rounded-full border border-[var(--accent)]/40 px-2.5 py-1 text-[var(--accent)]">
            Ready to save
          </span>
        )}
      </div>

      {warning ? <p className="text-[var(--warm)]">{warning}</p> : null}

      {missing.length ? (
        <div className="rounded-xl border border-[var(--warm)]/30 bg-[var(--warm)]/5 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--warm)]">Fill these in</p>
          <ul className="mt-2 space-y-1 text-[var(--cream)]/90">
            {missing.map((key) => (
              <li key={key}>· {MISSING_PROMPTS[key]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="block">
        <span className={`text-[10px] uppercase tracking-[0.2em] ${missingSet.has("title") ? "text-[var(--warm)]" : "text-[var(--muted)]"}`}>
          {labelFor("title", "Title")}
        </span>
        <input
          required
          autoFocus={missingSet.has("title")}
          value={draft.title}
          onChange={(e) => onField("title", e.target.value)}
          placeholder="e.g. Senior Instructional Designer"
          className={missingSet.has("title") ? needed : field}
        />
      </label>

      <label className="block">
        <span className={`text-[10px] uppercase tracking-[0.2em] ${missingSet.has("company") ? "text-[var(--warm)]" : "text-[var(--muted)]"}`}>
          {labelFor("company", "Company")}
        </span>
        <input
          required
          autoFocus={!missingSet.has("title") && missingSet.has("company")}
          value={draft.company}
          onChange={(e) => onField("company", e.target.value)}
          placeholder="Employer name"
          className={missingSet.has("company") ? needed : field}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={`text-[10px] uppercase tracking-[0.2em] ${missingSet.has("location") ? "text-[var(--warm)]" : "text-[var(--muted)]"}`}>
            {labelFor("location", "Location (city / state)")}
          </span>
          <input
            required={!draft.workType}
            value={draft.location}
            onChange={(e) => onField("location", e.target.value)}
            placeholder="Austin, TX"
            className={missingSet.has("location") ? needed : field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Work arrangement</span>
          <select
            value={draft.workType}
            onChange={(e) => {
              const next = e.target.value as WorkType;
              onField("workType", next);
              onField("location", stripWorkArrangement(draft.location) || draft.location);
            }}
            className={field}
          >
            <option value="">Unknown</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className={`text-[10px] uppercase tracking-[0.2em] ${missingSet.has("url") ? "text-[var(--warm)]" : "text-[var(--muted)]"}`}>
          {labelFor("url", "Posting URL")}
        </span>
        <input
          required
          type="url"
          value={draft.url}
          onChange={(e) => onField("url", e.target.value)}
          placeholder="https://"
          className={missingSet.has("url") ? needed : field}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Rate label (optional)</span>
          <input
            value={draft.rate}
            onChange={(e) => onField("rate", e.target.value)}
            placeholder="$120k–$140k or $45–$55/hr"
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Pay period</span>
          <select
            value={draft.salaryPeriod}
            onChange={(e) =>
              onField(
                "salaryPeriod",
                e.target.value as IngestFields["salaryPeriod"],
              )
            }
            className={field}
          >
            <option value="">Unknown</option>
            <option value="annual">Annual</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Salary / rate min</span>
          <input
            type="number"
            inputMode="decimal"
            value={draft.salaryMin ?? ""}
            onChange={(e) =>
              onField(
                "salaryMin",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            placeholder="e.g. 120000 or 45"
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Salary / rate max</span>
          <input
            type="number"
            inputMode="decimal"
            value={draft.salaryMax ?? ""}
            onChange={(e) =>
              onField(
                "salaryMax",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            placeholder="e.g. 140000 or 55"
            className={field}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Employment / hours</span>
          <input
            value={draft.employmentType}
            onChange={(e) => onField("employmentType", e.target.value)}
            placeholder="Full-time · 20 hrs/week · Contract"
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</span>
          <select value={status} onChange={(e) => onStatus(e.target.value as JobStatus)} className={field}>
            {BOARD_COLUMNS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Date applied</span>
          <input
            type="date"
            value={draft.dateApplied}
            onChange={(e) => onField("dateApplied", e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Shared w/ ChatGPT</span>
          <input
            type="date"
            value={draft.dateDiscussed}
            onChange={(e) => onField("dateDiscussed", e.target.value)}
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Description</span>
        <textarea
          rows={8}
          value={draft.description}
          onChange={(e) => onField("description", e.target.value)}
          className={field}
        />
      </label>

      <p className="text-xs text-[var(--muted)]">
        Leave dates blank if not yet applied — you can set them later from the job form.
      </p>

      {error ? <p className="text-red-300">{error}</p> : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--ink)]">
          Save application
        </button>
        <button type="button" onClick={onBack} className="rounded-lg border border-white/20 px-4 py-2">
          Back
        </button>
      </div>
    </form>
  );
}

function JobForm({
  job,
  onChange,
  onSave,
  onDelete,
}: {
  job: JobApplication;
  onChange: (job: JobApplication) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  function set<K extends keyof JobApplication>(key: K, value: JobApplication[K]) {
    onChange({ ...job, [key]: value });
  }
  const field =
    "mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]";
  const workType = (normalizeWorkType(job.location) ||
    (isPureWorkArrangementLabel(job.employmentType)
      ? normalizeWorkType(job.employmentType)
      : "") ||
    "") as WorkType;

  function setWorkType(next: WorkType) {
    const place = stripWorkArrangement(job.location);
    const location = composeLocation({ location: place, workType: next }) || place;
    const employmentType = isPureWorkArrangementLabel(job.employmentType)
      ? ""
      : job.employmentType;
    onChange({ ...job, location, employmentType });
  }

  return (
    <form
      className="space-y-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Title</span>
        <input required value={job.title} onChange={(e) => set("title", e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Company</span>
        <input required value={job.company} onChange={(e) => set("company", e.target.value)} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Location</span>
          <input
            value={stripWorkArrangement(job.location) || job.location}
            onChange={(e) => {
              const place = e.target.value;
              const location = composeLocation({ location: place, workType }) || place;
              set("location", location);
            }}
            className={field}
            placeholder="Austin, TX"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Work arrangement</span>
          <select
            value={workType}
            onChange={(e) => setWorkType(e.target.value as WorkType)}
            className={field}
          >
            <option value="">Unknown</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Date precision</span>
          <select
            value={job.datePrecision || "unknown"}
            onChange={(e) => set("datePrecision", e.target.value as JobApplication["datePrecision"])}
            className={field}
          >
            <option value="exact">exact</option>
            <option value="week_estimate">week_estimate</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</span>
          <select value={job.status} onChange={(e) => set("status", e.target.value as JobStatus)} className={field}>
            {BOARD_COLUMNS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Posting URL</span>
        <input type="url" value={job.url} onChange={(e) => set("url", e.target.value)} className={field} placeholder="https://" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Date applied</span>
          <input type="date" value={job.dateApplied} onChange={(e) => set("dateApplied", e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Shared w/ ChatGPT</span>
          <input type="date" value={job.dateDiscussed} onChange={(e) => set("dateDiscussed", e.target.value)} className={field} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Rate / salary</span>
          <input value={job.rate} onChange={(e) => set("rate", e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Employment / hours</span>
          <input
            value={isPureWorkArrangementLabel(job.employmentType) ? "" : job.employmentType}
            onChange={(e) => set("employmentType", e.target.value)}
            className={field}
            placeholder="Full-time · Part-time · Contract · 20 hrs/week"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Match score (0–10)</span>
        <input
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={job.matchScore ?? ""}
          onChange={(e) => set("matchScore", e.target.value === "" ? null : Number(e.target.value))}
          className={field}
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Description</span>
        <textarea rows={6} value={job.description} onChange={(e) => set("description", e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Notes</span>
        <textarea rows={4} value={job.notes} onChange={(e) => set("notes", e.target.value)} className={field} />
      </label>
      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--ink)]">
          Save
        </button>
        <button type="button" onClick={onDelete} className="rounded-lg border border-red-400/40 px-4 py-2 text-red-300">
          Delete
        </button>
      </div>
    </form>
  );
}
