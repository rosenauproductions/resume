"use client";

import { useCallback, useEffect, useState } from "react";

type BackupSummary = { id: string; createdAt: string; reason: string; count: number };
type TrashRow = { deletedAt: string; id: string; company: string; title: string; status: string };

const btnGhost =
  "rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[var(--muted)] hover:border-white/30 hover:text-[var(--cream)] disabled:opacity-50";
const btnAccent =
  "rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-50";

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Backups & restore for the applications table (Settings tab). */
export function PipelineBackups() {
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [trash, setTrash] = useState<TrashRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAll, setShowAll] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const load = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    fetch("/api/pipeline/backups", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load backups");
        if (!alive) return;
        setBackups(data.backups ?? []);
        setTrash(data.trash ?? []);
      })
      .catch((error: unknown) => {
        if (alive) setNotice(error instanceof Error ? error.message : "Failed to load backups");
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  async function act(body: Record<string, string>, done: string) {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/pipeline/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setNotice(done);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
      load();
    }
  }

  async function restore(b: BackupSummary) {
    const ok = window.confirm(
      `Restore the pipeline to ${when(b.createdAt)} (${b.count} applications)?\n\nYour current pipeline is backed up first, so this can be undone from this list.`,
    );
    if (!ok) return;
    if (await act({ action: "restore", id: b.id }, "Restored. Reloading…")) {
      window.location.reload();
    }
  }

  const visible = showAll ? backups : backups.slice(0, 8);

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-[var(--panel)]/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--cream)]">Backups &amp; restore</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            The pipeline is copied automatically before any import or save that removes applications,
            at most hourly before routine saves, and once a day. The latest 60 copies are kept.
          </p>
        </div>
        <button
          type="button"
          className={btnAccent}
          disabled={busy}
          onClick={() => void act({ action: "create" }, "Backup saved.")}
        >
          Back up now
        </button>
      </div>

      {notice ? <p className="text-xs text-[var(--accent)]">{notice}</p> : null}

      {backups.length ? (
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {visible.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-[var(--cream)]">
                  {when(b.createdAt)} · {b.count} applications
                </p>
                <p className="truncate text-xs text-[var(--muted)]">{b.reason}</p>
              </div>
              <button type="button" className={btnGhost} disabled={busy} onClick={() => void restore(b)}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--muted)]">No backups yet. Use “Back up now” to make the first one.</p>
      )}
      {backups.length > 8 ? (
        <button type="button" className={btnGhost} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${backups.length}`}
        </button>
      ) : null}

      <div className="pt-2">
        <h4 className="text-xs uppercase tracking-wider text-[var(--muted)]">Recently deleted</h4>
        {trash.length ? (
          <ul className="mt-2 divide-y divide-white/10 rounded-xl border border-white/10">
            {trash.slice(0, 20).map((t) => (
              <li key={`${t.id}-${t.deletedAt}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--cream)]">
                    {t.company} — {t.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t.status} · deleted {when(t.deletedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busy}
                  onClick={() => void act({ action: "restoreTrash", jobId: t.id }, `Restored ${t.company}. Reload to see it.`)}
                >
                  Undelete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[var(--muted)]">Nothing deleted yet.</p>
        )}
      </div>
    </section>
  );
}
