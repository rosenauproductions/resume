"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BOARD_COLUMNS,
  STATUS_LABELS,
  createEmptyJob,
  extractJobRecords,
  normalizeJob,
  type JobApplication,
  type JobStatus,
} from "@/lib/jobs/types";
import { computeInsights } from "@/lib/jobs/insights";

const LOCAL_KEY = "pipeline-jobs-v1";
type ViewMode = "board" | "timeline" | "insights";

const CHATGPT_PROMPT = `Export my job tracker as JSON (no markdown fences). Either:
1) { "applications": [ ... ] }  — your current format is fine
2) a bare JSON array of jobs

Per application, these fields are understood:
company, position|title, location, applied_date|dateApplied, salary|rate,
status (Pending→applied, Rejected→rejected, Not Submitted→researching, or pipeline statuses),
job_url, job_req, employment, hours, notes (string or array), tags`;

function loadLocal(): JobApplication[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeJob).filter((j): j is JobApplication => Boolean(j));
  } catch {
    return [];
  }
}

function saveLocal(jobs: JobApplication[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(jobs));
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
  return [...map.values()].sort((x, y) => y.dateApplied.localeCompare(x.dateApplied));
}

function parseImport(text: string): JobApplication[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Strip markdown fences if present
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const data = JSON.parse(candidate) as unknown;
    const list = extractJobRecords(data);
    if (!list.length) throw new Error("No applications found in JSON.");
    return list.map(normalizeJob).filter((j): j is JobApplication => Boolean(j));
  } catch (err) {
    if (err instanceof Error && err.message === "No applications found in JSON.") throw err;
    // fall through to markdown table
    // Markdown table fallback: | Title | Company | ...
    const lines = candidate.split("\n").filter((l) => l.includes("|"));
    if (lines.length < 2) throw new Error("Could not parse JSON. Paste a JSON array.");
    const headers = lines[0]
      .split("|")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    const rows = lines.slice(1).filter((l) => !/^\|?\s*-+/.test(l));
    return rows
      .map((row) => {
        const cells = row.split("|").map((c) => c.trim()).filter((_, i, arr) => !(i === 0 && arr[0] === "") && !(i === arr.length - 1 && arr[i] === ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h.replace(/\s+/g, "")] = cells[i] ?? "";
        });
        return normalizeJob({
          title: obj.title || obj.role || obj.job,
          company: obj.company || obj.where,
          location: obj.location,
          dateApplied: obj.dateapplied || obj.date,
          rate: obj.rate || obj.salary,
          status: obj.status,
          description: obj.description || obj.notes,
          source: obj.source,
          tags: obj.tags,
          notes: obj.notes,
        });
      })
      .filter((j): j is JobApplication => Boolean(j));
  }
}

export function PipelineApp() {
  const [booting, setBooting] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [view, setView] = useState<ViewMode>("board");
  const [storageMode, setStorageMode] = useState<"local" | "blob">("local");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [detail, setDetail] = useState<JobApplication | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const insights = useMemo(() => computeInsights(jobs), [jobs]);

  const persist = useCallback(async (next: JobApplication[]) => {
    setJobs(next);
    saveLocal(next);
    setSaving(true);
    try {
      const res = await fetch("/api/pipeline/jobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: next }),
      });
      if (res.ok) {
        setStorageMode("blob");
        setNotice("Synced to private server storage");
      } else if (res.status === 501) {
        setStorageMode("local");
      }
    } catch {
      setStorageMode("local");
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(""), 2500);
    }
  }, []);

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
        const remote = await fetch("/api/pipeline/jobs").then((r) => r.json());
        if (remote.storage === "blob" && Array.isArray(remote.jobs)) {
          const merged = mergeJobs(local, remote.jobs);
          setJobs(merged);
          saveLocal(merged);
          setStorageMode("blob");
        } else {
          setJobs(local);
          setStorageMode("local");
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
    const remote = await fetch("/api/pipeline/jobs").then((r) => r.json());
    if (remote.storage === "blob" && Array.isArray(remote.jobs)) {
      const merged = mergeJobs(local, remote.jobs);
      setJobs(merged);
      saveLocal(merged);
      setStorageMode("blob");
    } else {
      setJobs(local);
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
      const incoming = parseImport(importText);
      if (!incoming.length) {
        setImportError("No jobs found in paste.");
        return;
      }
      const stamped = incoming.map((j) => ({ ...j, updatedAt: new Date().toISOString() }));
      const next = mode === "replace" ? stamped : mergeJobs(jobs, stamped);
      void persist(next);
      setImportOpen(false);
      setImportText("");
      setNotice(`Imported ${stamped.length} job(s)`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    }
  }

  if (booting) {
    return (
      <main className="min-h-screen grid place-items-center bg-[var(--ink)] text-[var(--muted)]">
        Loading pipeline…
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="min-h-screen grid place-items-center bg-[var(--ink)] px-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[var(--panel)] p-8">
          <p className="section-kicker">Pipeline</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--cream)]">
            Not configured
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Set <code className="text-[var(--accent)]">JOB_TRACKER_SECRET</code> in your environment
            (Vercel project env vars), then redeploy.
          </p>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[var(--ink)]">
        <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-[var(--warm)]/10 blur-3xl" />
        <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
          <p className="section-kicker">Private</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--cream)]">
            Pipeline
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Password-gated job application tracker. Not linked from the public site.
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
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition hover:brightness-110"
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
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent)]">Private · noindex</p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">Pipeline</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]">
              {storageMode === "blob" ? "Synced" : "Browser storage"}
              {saving ? " · saving…" : ""}
            </span>
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

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Applied this week" value={String(insights.appliedThisWeek)} />
          <Stat label="Interviews open" value={String(insights.interviewsOpen)} />
          <Stat label="Response rate" value={`${insights.responseRate}%`} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              ["board", "Board"],
              ["timeline", "Timeline"],
              ["insights", "Insights"],
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
          <span className="ml-auto self-center text-xs text-[var(--muted)]">{jobs.length} applications</span>
        </div>

        <div className="mt-6">
          {!jobs.length ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center">
              <p className="text-[var(--muted)]">No applications yet.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink)]"
                >
                  Import ChatGPT export
                </button>
                <button
                  type="button"
                  onClick={openNew}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm"
                >
                  Add manually
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const sample = (await import("@/lib/jobs/sample-export.json")).default;
                    const stamped = sample
                      .map((row) => normalizeJob(row))
                      .filter((j): j is JobApplication => Boolean(j))
                      .map((j) => ({ ...j, updatedAt: new Date().toISOString() }));
                    void persist(stamped);
                    setNotice("Loaded sample data — replace with your export anytime");
                  }}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-[var(--muted)]"
                >
                  Load sample
                </button>
              </div>
            </div>
          ) : null}

          {jobs.length && view === "board" ? (
            <Board jobs={jobs} onSelect={setDetail} onStatus={updateStatus} />
          ) : null}
          {jobs.length && view === "timeline" ? (
            <Timeline jobs={jobs} onSelect={setDetail} />
          ) : null}
          {jobs.length && view === "insights" ? (
            <InsightsPanel insights={insights} jobs={jobs} />
          ) : null}
        </div>
      </div>

      {detail ? (
        <Drawer onClose={() => setDetail(null)} title={`${detail.title} · ${detail.company}`}>
          <div className="space-y-3 text-sm">
            <MetaRow label="Status" value={STATUS_LABELS[detail.status]} />
            <MetaRow label="Location" value={detail.location || "—"} />
            <MetaRow label="Applied" value={detail.dateApplied || "—"} />
            <MetaRow label="Rate" value={detail.rate || "—"} />
            <MetaRow label="Source" value={detail.source || "—"} />
            <MetaRow label="Tags" value={detail.tags.join(", ") || "—"} />
            {detail.url ? (
              <div className="flex gap-3 border-b border-white/5 pb-2">
                <span className="w-24 shrink-0 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Link
                </span>
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  Open posting
                </a>
              </div>
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--cream)]/90">{detail.description || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--cream)]/90">{detail.notes || "—"}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => openEdit(detail)}
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteJob(detail.id)}
                className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-300"
              >
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
          <JobForm
            job={editing}
            onChange={setEditing}
            onSave={saveForm}
            onDelete={() => deleteJob(editing.id)}
          />
        </Drawer>
      ) : null}

      {importOpen ? (
        <Drawer onClose={() => setImportOpen(false)} title="Import from ChatGPT">
          <div className="space-y-4 text-sm">
            <p className="text-[var(--muted)]">
              Paste a JSON array (or markdown table). Use this prompt in ChatGPT:
            </p>
            <pre className="max-h-40 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-[var(--cream)]/90 whitespace-pre-wrap">
              {CHATGPT_PROMPT}
            </pre>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              placeholder='[{"title":"…","company":"…","status":"applied",...}]'
              className="w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs outline-none focus:border-[var(--accent)]"
            />
            {importError ? <p className="text-red-300">{importError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyImport("merge")}
                className="rounded-lg bg-[var(--accent)] px-3 py-2 font-semibold text-[var(--ink)]"
              >
                Merge import
              </button>
              <button
                type="button"
                onClick={() => applyImport("replace")}
                className="rounded-lg border border-[var(--warm)]/50 px-3 py-2 text-[var(--warm)]"
              >
                Replace all
              </button>
            </div>
          </div>
        </Drawer>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--panel)] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--cream)]">{value}</p>
    </div>
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
                  {job.tags.length ? (
                    <p className="mt-2 line-clamp-1 text-[10px] text-[var(--warm)]">{job.tags.join(" · ")}</p>
                  ) : null}
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

function Timeline({
  jobs,
  onSelect,
}: {
  jobs: JobApplication[];
  onSelect: (job: JobApplication) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, JobApplication[]>();
    for (const job of [...jobs].sort((a, b) => b.dateApplied.localeCompare(a.dateApplied))) {
      const key = job.dateApplied.slice(0, 7) || "unknown";
      map.set(key, [...(map.get(key) ?? []), job]);
    }
    return [...map.entries()];
  }, [jobs]);

  if (!jobs.length) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {grouped.map(([month, items]) => (
        <section key={month}>
          <h3 className="mb-3 font-[family-name:var(--font-display)] text-xl text-[var(--accent)]">
            {month}
          </h3>
          <ol className="relative space-y-3 border-l border-white/15 pl-5">
            {items.map((job) => (
              <li key={job.id}>
                <span className="absolute -left-[5px] mt-2 h-2.5 w-2.5 rounded-full bg-[var(--warm)]" />
                <button
                  type="button"
                  onClick={() => onSelect(job)}
                  className="w-full rounded-xl border border-white/10 bg-[var(--panel)] px-4 py-3 text-left hover:border-[var(--accent)]/40"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {job.title} <span className="text-[var(--muted)]">@ {job.company}</span>
                    </p>
                    <span className="text-xs text-[var(--muted)]">{job.dateApplied}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--warm)]">{STATUS_LABELS[job.status]}</p>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function InsightsPanel({
  insights,
  jobs,
}: {
  insights: ReturnType<typeof computeInsights>;
  jobs: JobApplication[];
}) {
  const max = Math.max(1, ...Object.values(insights.byStatus));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
        <h3 className="font-[family-name:var(--font-display)] text-xl">Outcomes</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Status mix across {insights.total} applications</p>
        <div className="mt-5 space-y-2">
          {BOARD_COLUMNS.map((status) => {
            const n = insights.byStatus[status];
            return (
              <div key={status} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-sm">
                <span className="text-[var(--muted)]">{STATUS_LABELS[status]}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(n / max) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">{n}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
        <h3 className="font-[family-name:var(--font-display)] text-xl">Focus map</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Tags weighted by interview/offer vs reject/avoid</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <GuidanceList title="Lean into" tone="good" items={insights.leanInto} />
          <GuidanceList title="Be cautious" tone="warn" items={insights.beCautious} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5 lg:col-span-2">
        <h3 className="font-[family-name:var(--font-display)] text-xl">Guidance</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Rules from your own outcomes — not external market data.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {insights.leanInto.slice(0, 3).map((item) => (
            <li key={`g-${item.label}`} className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-3 py-2">
              <span className="text-[var(--accent)]">Apply toward</span> roles tagged{" "}
              <strong>{item.label}</strong> — {item.reason}
            </li>
          ))}
          {insights.beCautious.slice(0, 3).map((item) => (
            <li key={`c-${item.label}`} className="rounded-xl border border-[var(--warm)]/30 bg-[var(--warm)]/5 px-3 py-2">
              <span className="text-[var(--warm)]">Think twice</span> on{" "}
              <strong>{item.label}</strong> — {item.reason}
            </li>
          ))}
          {!jobs.length ? (
            <li className="text-[var(--muted)]">Import or add a few applications to unlock guidance.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function GuidanceList({
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
    <div>
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color }}>
        {title}
      </p>
      <ul className="mt-2 space-y-2">
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
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center text-[var(--muted)]">
      No applications yet. Import a ChatGPT export or add a job.
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

  return (
    <form
      className="space-y-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Field label="Title">
        <input
          required
          value={job.title}
          onChange={(e) => set("title", e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </Field>
      <Field label="Company">
        <input
          required
          value={job.company}
          onChange={(e) => set("company", e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location">
          <input
            value={job.location}
            onChange={(e) => set("location", e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </Field>
        <Field label="Date applied">
          <input
            type="date"
            value={job.dateApplied}
            onChange={(e) => set("dateApplied", e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rate / salary">
          <input
            value={job.rate}
            onChange={(e) => set("rate", e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </Field>
        <Field label="Status">
          <select
            value={job.status}
            onChange={(e) => set("status", e.target.value as JobStatus)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          >
            {BOARD_COLUMNS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Source">
        <input
          value={job.source}
          onChange={(e) => set("source", e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </Field>
      <Field label="Job URL">
        <input
          value={job.url}
          onChange={(e) => set("url", e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </Field>
      <Field label="Tags (comma-separated)">
        <input
          value={job.tags.join(", ")}
          onChange={(e) =>
            set(
              "tags",
              e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            )
          }
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={4}
          value={job.description}
          onChange={(e) => set("description", e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </Field>
      <Field label="Notes">
        <textarea
          rows={3}
          value={job.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </Field>
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--ink)]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-400/40 px-4 py-2 text-red-300"
        >
          Delete
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
