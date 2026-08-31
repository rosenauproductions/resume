"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BOARD_COLUMNS,
  STATUS_LABELS,
  createEmptyJob,
  extractJobRecords,
  extractTrackerMeta,
  normalizeJob,
  type JobApplication,
  type JobStatus,
  type TrackerMeta,
} from "@/lib/jobs/types";
import { computeInsights } from "@/lib/jobs/insights";
import { loadSeedJobs, loadSeedMeta } from "@/lib/jobs/seed";
import { BarChart, DonutChart, StatCard, TimelineChart } from "./PipelineCharts";

const LOCAL_KEY = "pipeline-jobs-v2";
const META_KEY = "pipeline-meta-v2";
type ViewMode = "insights" | "board" | "list";

const CHATGPT_PROMPT = `Export my job tracker as JSON. Preferred wrapper:

{ "job_application_tracker": { "applications": [ ... ], "candidate": {...}, "notable_current_targets": [...], "career_strategy": {...} } }

Per application fields understood: company, position, application_status, application_date, location, salary{min,max,amount,period}, match_score_estimate, match_level, strong_matches, potential_gaps, notes, interview, employment_type, etc.
PascalCase and older formats still work.`;

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
  const meta = extractTrackerMeta(data);
  const targets = (meta?.targets ?? []).map((t) => t.company);
  const list = extractJobRecords(data);
  if (!list.length) throw new Error("No applications found in JSON.");
  const jobs = list
    .map((row) => normalizeJob(row, targets))
    .filter((j): j is JobApplication => Boolean(j));
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
  const [storageMode, setStorageMode] = useState<"local" | "blob">("local");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [detail, setDetail] = useState<JobApplication | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");

  const insights = useMemo(() => computeInsights(jobs, meta), [jobs, meta]);
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

  const persist = useCallback(async (next: JobApplication[], nextMeta: TrackerMeta | null = meta) => {
    setJobs(next);
    if (nextMeta) setMeta(nextMeta);
    saveLocal(next, nextMeta);
    setSaving(true);
    try {
      const res = await fetch("/api/pipeline/jobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: next }),
      });
      if (res.ok) setStorageMode("blob");
      else if (res.status === 501) setStorageMode("local");
    } catch {
      setStorageMode("local");
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(""), 2500);
    }
  }, [meta]);

  function hydrateFromSeed() {
    const seeded = loadSeedJobs();
    const seededMeta = loadSeedMeta();
    setJobs(seeded);
    setMeta(seededMeta);
    saveLocal(seeded, seededMeta);
    setNotice(`Loaded ${seeded.length} applications from tracker seed`);
    void persist(seeded, seededMeta);
  }

  useEffect(() => {
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
        const local = loadLocal();
        const localMeta = loadMetaLocal();
        if (local.length) {
          setJobs(local);
          setMeta(localMeta ?? loadSeedMeta());
        } else {
          const seeded = loadSeedJobs();
          const seededMeta = loadSeedMeta();
          setJobs(seeded);
          setMeta(seededMeta);
          saveLocal(seeded, seededMeta);
        }
        const remote = await fetch("/api/pipeline/jobs").then((r) => r.json());
        if (remote.storage === "blob" && Array.isArray(remote.jobs) && remote.jobs.length) {
          const current = loadLocal();
          const merged = mergeJobs(current, remote.jobs);
          setJobs(merged);
          saveLocal(merged, loadMetaLocal() ?? loadSeedMeta());
          setStorageMode("blob");
        }
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
    const local = loadLocal();
    if (local.length) {
      setJobs(local);
      setMeta(loadMetaLocal() ?? loadSeedMeta());
    } else {
      hydrateFromSeed();
    }
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

  function deleteJob(id: string) {
    if (!confirm("Delete this application?")) return;
    void persist(jobs.filter((j) => j.id !== id));
    setDetail(null);
    setFormOpen(false);
  }

  function updateStatus(id: string, status: JobStatus) {
    void persist(
      jobs.map((j) => (j.id === id ? { ...j, status, updatedAt: new Date().toISOString() } : j)),
    );
  }

  function applyImport(mode: "merge" | "replace") {
    setImportError("");
    try {
      const { jobs: incoming, meta: incomingMeta } = parseImport(importText);
      if (!incoming.length) {
        setImportError("No jobs found in paste.");
        return;
      }
      const stamped = incoming.map((j) => ({ ...j, updatedAt: new Date().toISOString() }));
      const next = mode === "replace" ? stamped : mergeJobs(jobs, stamped);
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
      void persist(next, nextMeta);
      setImportOpen(false);
      setImportText("");
      setNotice(`Imported ${stamped.length} job(s)`);
      setView("insights");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
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
              {storageMode === "blob" ? "Synced" : "Browser storage"}
              {saving ? " · saving…" : ""}
            </span>
            <button
              type="button"
              onClick={hydrateFromSeed}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:border-[var(--accent)]"
            >
              Load latest seed
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Applications" value={String(insights.total)} hint={`${insights.appliedThisWeek} dated this week`} />
          <StatCard
            label="Avg match"
            value={insights.avgMatchScore != null ? `${insights.avgMatchScore}/10` : "—"}
            hint={`${insights.withMatchScore} scored roles`}
          />
          <StatCard
            label="Interviews open"
            value={String(insights.interviewsOpen)}
            hint={`${insights.rejected} rejected`}
          />
          <StatCard
            label="Avg known pay"
            value={money(insights.avgAnnualMid)}
            hint={`${insights.abovePriorSalary}/${insights.knownSalaryCount} ≥ prior ${money(meta?.lastSalary)}`}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              ["insights", "Charts & trends"],
              ["board", "Board"],
              ["list", "All applications"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
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
              Prior salary {money(meta?.lastSalary)} · W2 preferred
            </span>
          )}
        </div>

        <div className="mt-6">
          {view === "insights" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <DonutChart
                  title="Pipeline mix"
                  subtitle="Status across all applications"
                  data={insights.statusChart}
                />
                <BarChart
                  title="Match score bands"
                  subtitle="Where your scored applications land"
                  data={insights.matchScoreChart}
                />
                <BarChart
                  title="Match level mix"
                  subtitle="Excellent / Very Good / Good / Unknown"
                  data={insights.matchLevelChart}
                />
                <TimelineChart data={insights.timelineChart} />
                <BarChart
                  title="Salary vs prior ($79K)"
                  subtitle="Annualized midpoint where known · teal ≥ prior"
                  data={insights.salaryVsPriorChart}
                  formatValue={(n) => `$${Math.round(n / 1000)}k`}
                />
                <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
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
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <GuidanceCard title="Lean into" tone="good" items={insights.leanInto} />
                <GuidanceCard title="Watch gaps" tone="warn" items={insights.gapThemes} />
                <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
                  <h3 className="font-[family-name:var(--font-display)] text-xl">Strategy</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{meta?.preferredEmployment}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Prefer</p>
                  <p className="mt-1 text-sm text-[var(--cream)]/90">
                    {(meta?.preferredWork ?? []).slice(0, 5).join(" · ")}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--warm)]">Less preferred</p>
                  <p className="mt-1 text-sm text-[var(--cream)]/90">
                    {(meta?.lessPreferred ?? []).slice(0, 4).join(" · ")}
                  </p>
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    Target {meta?.preferredTarget || "~$80K+"} · stretch {meta?.highValueTarget || "$100K+"}
                  </p>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <RankList
                  title="Top match scores"
                  jobs={insights.topMatches}
                  onSelect={setDetail}
                  primary={(j) => (j.matchScore != null ? `${j.matchScore}/10` : "—")}
                />
                <RankList
                  title="Highest known pay"
                  jobs={insights.topPay}
                  onSelect={setDetail}
                  primary={(j) => money(j.annualMid)}
                />
              </div>

              {(meta?.risks?.length || meta?.strengths?.length) ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
                    <h3 className="font-[family-name:var(--font-display)] text-xl">Profile strengths</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(meta?.strengths ?? []).map((s) => (
                        <span key={s} className="rounded-full border border-white/15 px-3 py-1 text-xs text-[var(--cream)]/85">
                          {s}
                        </span>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
                    <h3 className="font-[family-name:var(--font-display)] text-xl">Application risks</h3>
                    <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                      {(meta?.risks ?? []).map((r) => (
                        <li key={r.slice(0, 40)} className="border-l border-[var(--warm)]/40 pl-3">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </section>
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
        </div>
      </div>

      {detail ? (
        <Drawer onClose={() => setDetail(null)} title={`${detail.title} · ${detail.company}`}>
          <div className="space-y-3 text-sm">
            <MetaRow label="Status" value={`${STATUS_LABELS[detail.status]}${detail.statusRaw ? ` (${detail.statusRaw})` : ""}`} />
            <MetaRow label="Match" value={detail.matchScore != null ? `${detail.matchScore}/10 · ${detail.matchLevel || "—"}` : detail.matchLevel || "—"} />
            <MetaRow label="Location" value={detail.location || "—"} />
            <MetaRow label="Applied" value={detail.dateApplied || "—"} />
            <MetaRow label="Pay" value={detail.rate || money(detail.annualMid)} />
            <MetaRow label="Employment" value={detail.employmentType || "—"} />
            <MetaRow label="Source" value={detail.source || "—"} />
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
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
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
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
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
          <input value={job.location} onChange={(e) => set("location", e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Date applied</span>
          <input type="date" value={job.dateApplied} onChange={(e) => set("dateApplied", e.target.value)} className={field} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Rate / salary</span>
          <input value={job.rate} onChange={(e) => set("rate", e.target.value)} className={field} />
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
