"use client";

import type { ReactNode, DragEvent } from "react";
import type { ChartPoint } from "@/lib/jobs/insights";
import { STATUS_LABELS, type JobStatus } from "@/lib/jobs/types";

export function DismissiblePanel({
  children,
  onDismiss,
  className = "",
  dragId,
  draggingId,
  onPanelDragStart,
  onPanelDragOver,
  onPanelDrop,
  onPanelDragEnd,
}: {
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
  dragId?: string;
  draggingId?: string | null;
  onPanelDragStart?: (id: string, e: DragEvent) => void;
  onPanelDragOver?: (id: string, e: DragEvent) => void;
  onPanelDrop?: (id: string, e: DragEvent) => void;
  onPanelDragEnd?: () => void;
}) {
  const draggable = Boolean(dragId && onPanelDragStart);
  return (
    <div
      className={`relative ${draggingId && dragId === draggingId ? "opacity-55" : ""} ${className}`}
      draggable={draggable}
      onDragStart={
        draggable && dragId
          ? (e) => {
              if ((e.target as HTMLElement).closest("button,a,input,select,textarea")) {
                e.preventDefault();
                return;
              }
              onPanelDragStart?.(dragId, e);
            }
          : undefined
      }
      onDragOver={
        dragId && onPanelDragOver
          ? (e) => {
              e.preventDefault();
              onPanelDragOver(dragId, e);
            }
          : undefined
      }
      onDrop={
        dragId && onPanelDrop
          ? (e) => {
              e.preventDefault();
              onPanelDrop(dragId, e);
            }
          : undefined
      }
      onDragEnd={onPanelDragEnd}
    >
      {draggable ? (
        <span
          aria-hidden
          title="Drag to reorder"
          className="absolute left-2 top-2 z-[2] cursor-grab select-none rounded-md border border-white/10 bg-[var(--ink)]/70 px-1.5 py-0.5 text-[10px] tracking-widest text-[var(--muted)] backdrop-blur active:cursor-grabbing"
        >
          ⋮⋮
        </span>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          aria-label="Remove panel"
          onClick={onDismiss}
          className="absolute right-2 top-2 z-[2] flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-[var(--ink)]/70 text-sm text-[var(--muted)] backdrop-blur hover:border-white/25 hover:text-[var(--cream)]"
        >
          ×
        </button>
      ) : null}
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  onDismiss,
  dragId,
  draggingId,
  onPanelDragStart,
  onPanelDragOver,
  onPanelDrop,
  onPanelDragEnd,
}: {
  label: string;
  value: string;
  hint?: string;
  onDismiss?: () => void;
  dragId?: string;
  draggingId?: string | null;
  onPanelDragStart?: (id: string, e: DragEvent) => void;
  onPanelDragOver?: (id: string, e: DragEvent) => void;
  onPanelDrop?: (id: string, e: DragEvent) => void;
  onPanelDragEnd?: () => void;
}) {
  return (
    <DismissiblePanel
      onDismiss={onDismiss}
      dragId={dragId}
      draggingId={draggingId}
      onPanelDragStart={onPanelDragStart}
      onPanelDragOver={onPanelDragOver}
      onPanelDrop={onPanelDrop}
      onPanelDragEnd={onPanelDragEnd}
    >
      <div className="rounded-2xl border border-white/10 bg-[var(--panel)] px-4 py-4 pl-9 pr-10">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--cream)]">
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      </div>
    </DismissiblePanel>
  );
}

export function BarChart({
  title,
  subtitle,
  data,
  formatValue,
}: {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = formatValue ?? ((n: number) => String(n));

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
      <h3 className="font-[family-name:var(--font-display)] text-xl">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      <div className="mt-5 space-y-2.5">
        {data.length ? (
          data.map((d) => (
            <div key={d.label} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-sm">
              <span className="truncate text-[var(--muted)]" title={d.label}>
                {STATUS_LABELS[d.label as JobStatus] ?? d.label}
              </span>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(d.value / max) * 100}%`,
                    background: d.color || "var(--accent)",
                  }}
                />
              </div>
              <span className="min-w-[3.5rem] text-right tabular-nums text-[var(--cream)]">
                {fmt(d.value)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No data yet</p>
        )}
      </div>
    </section>
  );
}

export function TimelineChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
      <h3 className="font-[family-name:var(--font-display)] text-xl">Applications over time</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">Dated submissions only</p>
      {data.length ? (
        <div className="mt-6 flex h-40 items-end gap-2">
          {data.map((d) => (
            <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span className="text-xs tabular-nums text-[var(--cream)]">{d.value}</span>
              <div
                className="w-full rounded-t-md bg-[var(--accent)]/80"
                style={{ height: `${Math.max(8, (d.value / max) * 100)}%` }}
                title={`${d.label}: ${d.value}`}
              />
              <span className="w-full truncate text-center text-[10px] text-[var(--muted)]">
                {d.label.slice(5)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-[var(--muted)]">No dated applications yet</p>
      )}
    </section>
  );
}

export function DonutChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  const segments = data.map((d) => {
    const pct = d.value / total;
    const dash = pct * 100;
    const seg = { ...d, dash, offset };
    offset += dash;
    return seg;
  });

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
      <h3 className="font-[family-name:var(--font-display)] text-xl">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
        <svg viewBox="0 0 42 42" className="h-36 w-36 shrink-0 -rotate-90">
          <circle cx="21" cy="21" r="15.5" fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r="15.5"
              fill="transparent"
              stroke={s.color || "var(--accent)"}
              strokeWidth="4"
              strokeDasharray={`${s.dash} ${100 - s.dash}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>
        <ul className="w-full space-y-2 text-sm">
          {data.map((d) => (
            <li key={d.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[var(--muted)]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: d.color || "var(--accent)" }}
                />
                {STATUS_LABELS[d.label as JobStatus] ?? d.label}
              </span>
              <span className="tabular-nums">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export type VisitTimelinePoint = {
  id: string;
  occurredAt: string;
  path: string;
  locationLabel?: string;
};

/** Horizontal click timeline for one visitor’s visits. */
export function VisitTimelineChart({
  title,
  subtitle,
  points,
}: {
  title?: string;
  subtitle?: string;
  points: VisitTimelinePoint[];
}) {
  const sorted = [...points].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );
  const times = sorted.map((p) => Date.parse(p.occurredAt)).filter(Number.isFinite);
  const t0 = times[0] ?? Date.now();
  const t1 = times[times.length - 1] ?? t0;
  const span = Math.max(1, t1 - t0);

  function fmt(iso: string) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return iso;
    return new Date(t).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      {title ? (
        <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--cream)]">{title}</h3>
      ) : null}
      {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}

      <div className="relative mt-6 mb-2 h-16">
        <div className="absolute left-2 right-2 top-1/2 h-px bg-white/20" aria-hidden />
        {sorted.map((p, i) => {
          const t = Date.parse(p.occurredAt);
          const pct = sorted.length === 1 || !Number.isFinite(t) ? 50 : ((t - t0) / span) * 100;
          return (
            <div
              key={p.id}
              className="absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `calc(0.5rem + (100% - 1rem) * ${pct / 100})` }}
              title={`${fmt(p.occurredAt)} · ${p.path}`}
            >
              <span
                className={`block h-3.5 w-3.5 rounded-full border-2 ${
                  i === sorted.length - 1
                    ? "border-[var(--accent)] bg-[var(--accent)]"
                    : "border-[var(--cream)] bg-[var(--ink)]"
                }`}
              />
            </div>
          );
        })}
        {sorted.length > 1 ? (
          <>
            <span className="absolute left-2 top-[calc(50%+0.85rem)] text-[10px] tabular-nums text-[var(--muted)]">
              {fmt(sorted[0].occurredAt)}
            </span>
            <span className="absolute right-2 top-[calc(50%+0.85rem)] text-right text-[10px] tabular-nums text-[var(--muted)]">
              {fmt(sorted[sorted.length - 1].occurredAt)}
            </span>
          </>
        ) : null}
      </div>

      <ul className="mt-8 max-h-72 space-y-2 overflow-y-auto text-sm">
        {[...sorted].reverse().map((p) => (
          <li
            key={`row-${p.id}`}
            className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-0"
          >
            <div className="min-w-0">
              <p className="tabular-nums text-[var(--cream)]">{fmt(p.occurredAt)} CT</p>
              <p className="truncate text-xs text-[var(--muted)]">
                {p.path}
                {p.locationLabel ? ` · ${p.locationLabel}` : ""}
              </p>
            </div>
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
          </li>
        ))}
      </ul>
    </section>
  );
}

