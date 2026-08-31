"use client";

import type { ChartPoint } from "@/lib/jobs/insights";
import { STATUS_LABELS, type JobStatus } from "@/lib/jobs/types";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--panel)] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--cream)]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
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
