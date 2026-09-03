"use client";

import { useMemo, useState } from "react";
import {
  STATUS_LABELS,
  normalizeWorkType,
  type JobApplication,
  type JobStatus,
} from "@/lib/jobs/types";
import {
  CITY_COMPANY_ALIASES,
  REMOTE_CLUSTER,
  RESUME_HUB,
  companyMatchesAliases,
  extractCityKey,
  isRemoteLocation,
  jitterOffset,
  lookupCity,
  packRemoteClusterPoint,
  projectUS,
} from "@/lib/pipeline/geo-cities";
import { US_MAP_VIEWBOX, US_STATE_PATHS } from "@/lib/pipeline/us-map-paths";

export type MapVisit = {
  id: string;
  city: string;
  region: string;
  country: string;
  locationLabel: string;
  linkConfidence: string;
  linkedApplicationId: string | null;
  /** Optional; used to skip pipeline self-visits when present. */
  path?: string;
  linkReason?: string;
};

type RadarTone = "job" | "city";

type RadarGlow = {
  id: string;
  x: number;
  y: number;
  count: number;
  tone: RadarTone;
};

type WorkArrangement = "onsite" | "hybrid" | "remote" | "unknown";

type StatusStrokeKind = "rejected" | "applied" | "progress";

type MapStatusFilter = "all" | "researching" | "applied" | "progress" | "rejected";

type TargetNode = {
  job: JobApplication;
  cityKey: string | null;
  geoLabel: string;
  x: number;
  y: number;
  hits: number;
  linkedHits: number;
  suggestedHits: number;
  remote: boolean;
  workType: WorkArrangement;
  strokeKind: StatusStrokeKind;
};

type UnlinkedPin = {
  cityKey: string;
  label: string;
  x: number;
  y: number;
  count: number;
};

const FILL = {
  onsite: "#4a8fd4",
  hybrid: "var(--accent)",
  remote: "#3d9a6a",
  unknown: "color-mix(in oklab, var(--cream) 62%, var(--muted))",
} as const;

const STROKE = {
  rejected: "#ef6b6b",
  applied: "#e8b84a",
  progress: "#7CFFB2",
} as const;

const FILTERS: { id: MapStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "researching", label: "Researching" },
  { id: "applied", label: "Applied" },
  { id: "progress", label: "In progress" },
  { id: "rejected", label: "Rejected" },
];

function inferWorkType(job: JobApplication, inRemoteCluster: boolean): WorkArrangement {
  const fromEmployment = normalizeWorkType(job.employmentType);
  const fromLocation = normalizeWorkType(job.location);
  const wt = fromEmployment || fromLocation;
  if (wt === "onsite" || wt === "hybrid" || wt === "remote") return wt;
  if (inRemoteCluster || isRemoteLocation(job.location)) return "remote";
  return "unknown";
}

function strokeKindFor(status: JobStatus, hits: number): StatusStrokeKind {
  if (status === "rejected" || status === "withdrawn" || status === "avoid") {
    return "rejected";
  }
  if (
    hits >= 2 ||
    status === "researching" ||
    status === "screen" ||
    status === "interview" ||
    status === "offer"
  ) {
    return "progress";
  }
  return "applied";
}

function matchesFilter(job: JobApplication, filter: MapStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "researching") return job.status === "researching";
  if (filter === "applied") return job.status === "applied";
  if (filter === "progress") {
    return job.status === "screen" || job.status === "interview" || job.status === "offer";
  }
  return job.status === "rejected" || job.status === "withdrawn" || job.status === "avoid";
}

function workTypeLabel(wt: WorkArrangement): string {
  if (wt === "onsite") return "Onsite";
  if (wt === "hybrid") return "Hybrid";
  if (wt === "remote") return "Remote";
  return "Unknown";
}

/** ~20% larger than prior map radii; hit hierarchy preserved. */
function hitRadius(hits: number, maxHits: number) {
  if (hits <= 0) return 6;
  const t = Math.min(1, hits / Math.max(1, maxHits));
  return 7.2 + t * 16.8;
}

function hitOpacity(hits: number, maxHits: number) {
  if (hits <= 0) return 0.55;
  const t = Math.min(1, hits / Math.max(1, maxHits));
  return 0.65 + t * 0.35;
}

function edgeStroke(hits: number, maxHits: number) {
  if (hits <= 0) return { width: 0.6, opacity: 0.12 };
  const t = Math.min(1, hits / Math.max(1, maxHits));
  return { width: 0.8 + t * 3.2, opacity: 0.2 + t * 0.55 };
}

function remoteDotRadius(hits: number, maxHits: number) {
  if (hits <= 0) return 4.8;
  const t = Math.min(1, hits / Math.max(1, maxHits));
  return 5.4 + t * 9.6;
}

function targetStrokeWidth(hits: number, active: boolean) {
  if (active) return 2.8;
  if (hits >= 2) return 2.5;
  return 2.15;
}

function shortTitle(title: string, max = 42) {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Visit-count tiers for radar glow intensity. */
function radarTier(count: number): 1 | 2 | 3 | 4 {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

function radarParams(count: number) {
  const tier = radarTier(count);
  switch (tier) {
    case 1:
      // Barely visible
      return { tier, baseR: 14, fillOp: 0.07, strokeOp: 0.18, rings: 1, duration: 3.4, pulse: false };
    case 2:
      // Noticeable
      return { tier, baseR: 20, fillOp: 0.12, strokeOp: 0.32, rings: 2, duration: 2.9, pulse: true };
    case 3:
      // Strong
      return { tier, baseR: 28, fillOp: 0.18, strokeOp: 0.45, rings: 2, duration: 2.4, pulse: true };
    case 4:
      // Strongest
      return { tier, baseR: 38, fillOp: 0.26, strokeOp: 0.58, rings: 3, duration: 2.0, pulse: true };
  }
}

function isPipelineSelfVisit(v: MapVisit): boolean {
  const path = (v.path || "").trim();
  if (path === "/pipeline" || path.startsWith("/pipeline/")) return true;
  const reason = (v.linkReason || "").toLowerCase();
  return reason.includes("pipeline self-visit");
}

function renderRadarGlow(g: RadarGlow) {
  const p = radarParams(g.count);
  const stroke =
    g.tone === "job"
      ? "var(--accent)"
      : "color-mix(in oklab, var(--warm) 55%, var(--muted))";
  const fill =
    g.tone === "job"
      ? "color-mix(in oklab, var(--accent) 70%, transparent)"
      : "color-mix(in oklab, var(--warm) 45%, var(--muted))";

  const rings = Array.from({ length: p.rings }, (_, i) => {
    const r = p.baseR * (0.55 + i * 0.35);
    const delay = i * 0.45;
    return (
      <circle
        key={`ring-${i}`}
        className={p.pulse ? "radar-ring" : undefined}
        cx={g.x}
        cy={g.y}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={1.1 + i * 0.25}
        strokeOpacity={p.strokeOp * (1 - i * 0.22)}
        style={
          p.pulse
            ? {
                animationDuration: `${p.duration}s`,
                animationDelay: `${delay}s`,
              }
            : undefined
        }
      />
    );
  });

  return (
    <g key={g.id} className="radar-glow" pointerEvents="none" aria-hidden>
      <circle
        cx={g.x}
        cy={g.y}
        r={p.baseR * 0.72}
        fill={fill}
        fillOpacity={p.fillOp}
        filter="url(#radar-soft)"
      />
      {rings}
    </g>
  );
}

export function TargetMap({
  jobs,
  visits,
  onSelectJob,
  loading,
  onRefresh,
}: {
  jobs: JobApplication[];
  visits: MapVisit[];
  onSelectJob: (job: JobApplication) => void;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showZero, setShowZero] = useState(true);
  const [showUnlinked, setShowUnlinked] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MapStatusFilter>("all");

  const hub = useMemo(() => {
    const p = projectUS(RESUME_HUB.lng, RESUME_HUB.lat);
    return p ? { ...RESUME_HUB, ...p } : { ...RESUME_HUB, x: 500, y: 350 };
  }, []);

  const { targets, unlinked, maxHits, geoTargets, remoteTargets, remoteCount, totalHits, radarGlows } =
    useMemo(() => {
      const activeVisits = visits.filter(
        (v) => v.linkConfidence !== "ignored" && !isPipelineSelfVisit(v),
      );

      const cityBuckets = new Map<string, MapVisit[]>();
      for (const v of activeVisits) {
        const key = extractCityKey(v.city) || extractCityKey(v.locationLabel);
        if (!key) continue;
        const list = cityBuckets.get(key) ?? [];
        list.push(v);
        cityBuckets.set(key, list);
      }

      // Unique city-alias → jobId (null = ambiguous among open apps)
      const aliasOwner = new Map<string, string | null>();
      for (const cityKey of Object.keys(CITY_COMPANY_ALIASES)) {
        const matches = jobs.filter((j) => companyMatchesAliases(j.company, cityKey));
        if (matches.length === 1) aliasOwner.set(cityKey, matches[0].id);
        else if (matches.length > 1) aliasOwner.set(cityKey, null);
      }

      const claimedVisitIds = new Set<string>();
      const nodes: TargetNode[] = [];
      const pendingRemote: Omit<TargetNode, "x" | "y">[] = [];
      const byCityIndex = new Map<string, number>();

      for (const job of jobs) {
        const remote = isRemoteLocation(job.location);
        const geo = lookupCity(job.location);
        const cityKey = extractCityKey(job.location);

        let linkedHits = 0;
        let suggestedHits = 0;

        for (const v of activeVisits) {
          if (v.linkedApplicationId === job.id) {
            linkedHits += 1;
            claimedVisitIds.add(v.id);
            continue;
          }
          if (v.linkedApplicationId) continue;
          const vKey = extractCityKey(v.city) || extractCityKey(v.locationLabel);
          if (!vKey) continue;
          // Only attribute when city alias uniquely points at this job
          if (aliasOwner.get(vKey) === job.id) {
            suggestedHits += 1;
            claimedVisitIds.add(v.id);
          }
        }

        const hits = linkedHits + suggestedHits;
        const locLabel = (job.location || "").trim();
        const emptyish =
          !locLabel ||
          /^not\s*specified$/i.test(locLabel) ||
          /^n\/?a$/i.test(locLabel) ||
          /^unknown$/i.test(locLabel);

        // Prefer a geocodable city (e.g. "Remote / Austin, TX") over the remote box
        if (geo) {
          const projected = projectUS(geo.lng, geo.lat);
          if (projected) {
            const idx = byCityIndex.get(geo.label) ?? 0;
            byCityIndex.set(geo.label, idx + 1);
            const jitter = jitterOffset(job.id || job.company, idx);
            const workType = inferWorkType(job, false);
            nodes.push({
              job,
              cityKey,
              geoLabel: geo.label,
              x: projected.x + jitter.dx,
              y: projected.y + jitter.dy,
              hits,
              linkedHits,
              suggestedHits,
              remote: false,
              workType,
              strokeKind: strokeKindFor(job.status, hits),
            });
            continue;
          }
        }

        // Remote / empty / unprojected → cluster box near Mexico
        pendingRemote.push({
          job,
          cityKey,
          geoLabel: remote
            ? locLabel || "Remote"
            : emptyish
              ? "No location"
              : locLabel || "Unknown",
          hits,
          linkedHits,
          suggestedHits,
          remote: true,
          workType: inferWorkType(job, true),
          strokeKind: strokeKindFor(job.status, hits),
        });
      }

      const remoteCount = pendingRemote.length;
      pendingRemote.forEach((node, index) => {
        const pt = packRemoteClusterPoint(index, remoteCount, node.job.id || node.job.company);
        nodes.push({ ...node, x: pt.x, y: pt.y });
      });

      const unlinked: UnlinkedPin[] = [];
      for (const [cityKey, list] of cityBuckets) {
        const remaining = list.filter((v) => !claimedVisitIds.has(v.id));
        if (!remaining.length) continue;
        const geo = lookupCity(cityKey);
        if (!geo) continue;
        const projected = projectUS(geo.lng, geo.lat);
        if (!projected) continue;
        unlinked.push({
          cityKey,
          label: geo.label,
          x: projected.x,
          y: projected.y,
          count: remaining.length,
        });
      }

      const geoTargets = nodes.filter((n) => !n.remote);
      const remoteTargets = nodes.filter((n) => n.remote);
      const maxHits = Math.max(
        1,
        ...nodes.map((n) => n.hits),
        ...unlinked.map((u) => u.count),
      );
      const totalHits = nodes.reduce((s, n) => s + n.hits, 0);

      // Radar glows: job targets with hits, else unlinked city pins
      const radarGlows: RadarGlow[] = [
        ...nodes
          .filter((n) => n.hits > 0)
          .map((n) => ({
            id: `glow-job-${n.job.id}`,
            x: n.x,
            y: n.y,
            count: n.hits,
            tone: "job" as const,
          })),
        ...unlinked.map((u) => ({
          id: `glow-city-${u.cityKey}`,
          x: u.x,
          y: u.y,
          count: u.count,
          tone: "city" as const,
        })),
      ];

      return {
        targets: nodes,
        unlinked,
        maxHits,
        geoTargets,
        remoteTargets,
        remoteCount,
        totalHits,
        radarGlows,
      };
    }, [jobs, visits]);

  const filterPass = (t: TargetNode) => matchesFilter(t.job, statusFilter);
  const dimNonMatch = statusFilter !== "all";

  const visibleGeo = (showZero ? geoTargets : geoTargets.filter((t) => t.hits > 0)).filter(
    (t) => !dimNonMatch || filterPass(t),
  );
  const visibleRemote = (showZero ? remoteTargets : remoteTargets.filter((t) => t.hits > 0)).filter(
    (t) => !dimNonMatch || filterPass(t),
  );
  // When filtering, keep non-matches on map but dimmed; edges only for visible matches
  const allGeoDraw = showZero ? geoTargets : geoTargets.filter((t) => t.hits > 0);
  const allRemoteDraw = showZero ? remoteTargets : remoteTargets.filter((t) => t.hits > 0);
  const drawGeo = dimNonMatch ? allGeoDraw : visibleGeo;
  const drawRemote = dimNonMatch ? allRemoteDraw : visibleRemote;
  const edgeTargets = [...visibleGeo, ...visibleRemote];

  const hovered = hoverId ? targets.find((t) => t.job.id === hoverId) : null;
  const ranked = [...targets]
    .filter((t) => filterPass(t))
    .sort((a, b) => b.hits - a.hits || a.job.company.localeCompare(b.job.company));

  const { boxX, boxY, boxW, boxH, label: remoteLabel } = REMOTE_CLUSTER;

  function renderTargetDot(t: TargetNode, kind: "geo" | "remote") {
    const r = kind === "geo" ? hitRadius(t.hits, maxHits) : remoteDotRadius(t.hits, maxHits);
    const op = hitOpacity(t.hits, maxHits);
    const active = hoverId === t.job.id;
    const matched = filterPass(t);
    const faded = dimNonMatch && !matched;
    const fill = FILL[t.workType];
    const stroke = STROKE[t.strokeKind];
    const sw = targetStrokeWidth(t.hits, active);

    return (
      <g
        key={t.job.id}
        className="cursor-pointer"
        onMouseEnter={() => setHoverId(t.job.id)}
        onMouseLeave={() => setHoverId(null)}
        onClick={() => onSelectJob(t.job)}
        opacity={faded ? 0.18 : hoverId && !active ? 0.38 : 1}
        style={faded ? { pointerEvents: "none" } : undefined}
      >
        {t.hits > 0 && !faded ? (
          <circle
            cx={t.x}
            cy={t.y}
            r={kind === "geo" ? Math.max(r + 4, 10) : Math.max(r + 3, 8)}
            fill={stroke}
            fillOpacity={0.08 + Math.min(0.14, t.hits * 0.03)}
            filter="url(#radar-soft)"
          />
        ) : null}
        <circle
          cx={t.x}
          cy={t.y}
          r={r}
          fill={fill}
          fillOpacity={op}
          stroke={active ? "var(--cream)" : stroke}
          strokeWidth={active ? sw + 0.4 : sw}
          filter={t.hits > 0 && !faded ? "url(#hit-glow)" : undefined}
        />
        {kind === "geo" && (active || t.hits > 0) && !faded ? (
          <text
            x={t.x}
            y={t.y + r + 12}
            textAnchor="middle"
            fill="var(--cream)"
            fontSize={10}
            opacity={0.9}
          >
            {t.job.shortName || t.job.company}
            {t.hits > 0 ? ` · ${t.hits}` : ""}
          </text>
        ) : null}
        <title>
          {`${t.job.company} — ${t.job.title}\n${t.geoLabel}\n${workTypeLabel(t.workType)} · ${STATUS_LABELS[t.job.status]}\n${t.hits} hit${t.hits === 1 ? "" : "s"} (${t.linkedHits} linked · ${t.suggestedHits} suggested)`}
        </title>
      </g>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
            Target map
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Fill = work arrangement · outline = pipeline status (green also for ≥2 resume hits).
            Soft radar rings mark visit intensity on job targets or unlinked cities.
            Remote and unplaced roles sit in the Mexico-side cluster.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} />
            Links
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />
            0-hit targets
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={showUnlinked}
              onChange={(e) => setShowUnlinked(e.target.checked)}
            />
            Unlinked visits
          </label>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:border-[var(--accent)]"
            >
              {loading ? "Refreshing…" : "Refresh visits"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Filter targets by status"
      >
        {FILTERS.map((f) => {
          const active = statusFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--cream)]"
                  : "border-white/12 text-[var(--muted)] hover:border-white/25 hover:text-[var(--cream)]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 45%, color-mix(in oklab, var(--accent) 8%, transparent), transparent 70%), radial-gradient(ellipse 50% 40% at 20% 80%, color-mix(in oklab, var(--warm) 6%, transparent), transparent 65%)",
            }}
          />
          <svg
            viewBox={US_MAP_VIEWBOX}
            className="relative z-[1] h-auto w-full"
            role="img"
            aria-label="US map of job targets and resume visit hits"
          >
            <defs>
              <filter id="hit-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="radar-soft" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="5.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                </feMerge>
              </filter>
              <style>{`
                @keyframes radar-pulse {
                  0% { transform: scale(0.72); opacity: 0.85; }
                  70% { transform: scale(1.55); opacity: 0.12; }
                  100% { transform: scale(1.75); opacity: 0; }
                }
                .radar-ring {
                  animation: radar-pulse 2.6s ease-out infinite;
                  transform-box: fill-box;
                  transform-origin: center;
                }
                @media (prefers-reduced-motion: reduce) {
                  .radar-ring {
                    animation: none !important;
                    opacity: 0.55;
                  }
                }
              `}</style>
            </defs>

            <g className="states">
              {US_STATE_PATHS.map((s) => (
                <path
                  key={s.id}
                  d={s.d}
                  fill="color-mix(in oklab, var(--cream) 6%, var(--panel))"
                  stroke="color-mix(in oklab, var(--cream) 14%, transparent)"
                  strokeWidth={0.6}
                />
              ))}
            </g>

            {showEdges
              ? edgeTargets.map((t) => {
                  const edge = edgeStroke(t.hits, maxHits);
                  return (
                    <line
                      key={`edge-${t.job.id}`}
                      x1={hub.x}
                      y1={hub.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={t.hits > 0 ? "var(--accent)" : "color-mix(in oklab, var(--muted) 50%, transparent)"}
                      strokeWidth={edge.width}
                      strokeOpacity={hoverId && hoverId !== t.job.id ? edge.opacity * 0.25 : edge.opacity}
                      strokeLinecap="round"
                    />
                  );
                })
              : null}

            {/* Resume hub */}
            <g>
              <circle cx={hub.x} cy={hub.y} r={9} fill="var(--cream)" opacity={0.95} />
              <circle cx={hub.x} cy={hub.y} r={4.5} fill="var(--ink)" />
              <text
                x={hub.x}
                y={hub.y - 14}
                textAnchor="middle"
                fill="var(--cream)"
                fontSize={11}
                fontFamily="var(--font-display), Georgia, serif"
              >
                Resume
              </text>
            </g>

            {/* Visit radar glows — under pins so targets stay readable */}
            <g className="radar-layer" aria-hidden>
              {radarGlows
                .filter((g) => {
                  if (g.tone === "city" && !showUnlinked) return false;
                  if (dimNonMatch && g.tone === "job") {
                    const t = targets.find((n) => `glow-job-${n.job.id}` === g.id);
                    if (t && !filterPass(t)) return false;
                  }
                  return true;
                })
                .map((g) => renderRadarGlow(g))}
            </g>

            {showUnlinked
              ? unlinked.map((u) => (
                  <g key={`u-${u.cityKey}`} opacity={0.85}>
                    <circle
                      cx={u.x}
                      cy={u.y}
                      r={5 + Math.min(9.5, u.count * 1.8)}
                      fill="color-mix(in oklab, var(--muted) 55%, transparent)"
                      stroke="color-mix(in oklab, var(--muted) 80%, white)"
                      strokeWidth={1.2}
                    />
                    <title>{`${u.label}: ${u.count} unlinked visit${u.count === 1 ? "" : "s"}`}</title>
                  </g>
                ))
              : null}

            {/* Remote / no-location cluster near Mexico */}
            {remoteTargets.length > 0 ? (
              <g aria-label={remoteLabel}>
                <rect
                  x={boxX}
                  y={boxY}
                  width={boxW}
                  height={boxH}
                  rx={14}
                  ry={14}
                  fill="color-mix(in oklab, var(--ink) 55%, transparent)"
                  stroke="color-mix(in oklab, var(--warm) 45%, var(--cream))"
                  strokeWidth={1.2}
                  strokeOpacity={0.55}
                />
                <rect
                  x={boxX + 1.5}
                  y={boxY + 1.5}
                  width={boxW - 3}
                  height={boxH - 3}
                  rx={12}
                  ry={12}
                  fill="color-mix(in oklab, var(--accent) 6%, transparent)"
                  stroke="none"
                />
                <text
                  x={boxX + boxW / 2}
                  y={boxY + 16}
                  textAnchor="middle"
                  fill="var(--cream)"
                  fontSize={10}
                  fontFamily="var(--font-display), Georgia, serif"
                  opacity={0.92}
                >
                  {remoteLabel}
                </text>
              </g>
            ) : null}

            {drawGeo.map((t) => renderTargetDot(t, "geo"))}
            {drawRemote.map((t) => renderTargetDot(t, "remote"))}
          </svg>

          {/* On-map color key */}
          <div className="pointer-events-none absolute left-3 top-3 z-[2] max-w-[14rem] rounded-xl border border-white/10 bg-[var(--ink)]/85 px-2.5 py-2 text-[10px] backdrop-blur">
            <p className="mb-1.5 font-medium uppercase tracking-[0.16em] text-[var(--muted)]">Fill</p>
            <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[var(--cream)]/90">
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: FILL.onsite }} />
                Onsite
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                Hybrid
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: FILL.remote }} />
                Remote
              </li>
            </ul>
            <p className="mb-1.5 font-medium uppercase tracking-[0.16em] text-[var(--muted)]">Stroke</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--cream)]/90">
              <li className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full bg-transparent"
                  style={{ border: `2px solid ${STROKE.rejected}` }}
                />
                Rejected
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full bg-transparent"
                  style={{ border: `2px solid ${STROKE.applied}` }}
                />
                Applied
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full bg-transparent"
                  style={{ border: `2px solid ${STROKE.progress}` }}
                />
                In progress / hits
              </li>
            </ul>
          </div>

          {hovered ? (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[2] rounded-xl border border-white/10 bg-[var(--ink)]/92 px-3 py-2.5 text-sm backdrop-blur sm:right-auto sm:max-w-sm">
              <p className="font-medium text-[var(--cream)]">{hovered.job.company}</p>
              <p className="text-xs text-[var(--muted)]">{shortTitle(hovered.job.title)}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="inline-flex items-center gap-1 text-[var(--cream)]/90">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: FILL[hovered.workType] }}
                  />
                  {workTypeLabel(hovered.workType)}
                </span>
                <span className="text-[var(--muted)]">·</span>
                <span className="inline-flex items-center gap-1 text-[var(--cream)]/90">
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-transparent"
                    style={{ border: `2px solid ${STROKE[hovered.strokeKind]}` }}
                  />
                  {STATUS_LABELS[hovered.job.status]}
                </span>
                <span className="text-[var(--muted)]">·</span>
                <span className="text-[var(--accent)]">
                  {hovered.hits} hit{hovered.hits === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {hovered.geoLabel}
                {hovered.linkedHits || hovered.suggestedHits
                  ? ` · ${hovered.linkedHits} linked / ${hovered.suggestedHits} suggested`
                  : " · no visits yet"}
                {" · click for detail"}
              </p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[var(--panel)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Legend</p>
            <ul className="mt-3 space-y-2 text-xs text-[var(--muted)]">
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--cream)]" />
                Resume hub (DFW)
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FILL.onsite }} />
                Onsite fill
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                Hybrid fill
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FILL.remote }} />
                Remote fill
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full bg-transparent"
                  style={{ border: `2px solid ${STROKE.rejected}` }}
                />
                Rejected / withdrawn stroke
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full bg-transparent"
                  style={{ border: `2px solid ${STROKE.applied}` }}
                />
                Applied / awaiting stroke
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full bg-transparent"
                  style={{ border: `2px solid ${STROKE.progress}` }}
                />
                In progress or ≥2 hits
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--muted)] opacity-60" />
                Unlinked visit city
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, color-mix(in oklab, var(--accent) 55%, transparent), transparent 70%)",
                    boxShadow: "0 0 0 1px color-mix(in oklab, var(--accent) 35%, transparent)",
                  }}
                />
                Visit radar (1 → 5+)
              </li>
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
              {geoTargets.length} mapped · {remoteCount} remote/unplaced · {totalHits} attributed hits
              {unlinked.length ? ` · ${unlinked.reduce((s, u) => s + u.count, 0)} unlinked` : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[var(--panel)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Hit board</p>
            <ul className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto text-sm">
              {ranked.slice(0, 24).map((t) => (
                <li key={t.job.id}>
                  <button
                    type="button"
                    onClick={() => onSelectJob(t.job)}
                    onMouseEnter={() => setHoverId(t.job.id)}
                    onMouseLeave={() => setHoverId(null)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      hoverId === t.job.id ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      <span className="inline-flex items-center gap-1.5 text-[var(--cream)]">
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: FILL[t.workType],
                            boxShadow: `0 0 0 1.5px ${STROKE[t.strokeKind]}`,
                          }}
                        />
                        {t.job.shortName || t.job.company}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--muted)]">
                        {t.remote ? `Remote · ${t.geoLabel}` : t.geoLabel}
                        {" · "}
                        {STATUS_LABELS[t.job.status]}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${
                        t.hits > 0 ? "text-[var(--accent)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {t.hits}
                    </span>
                  </button>
                </li>
              ))}
              {!ranked.length ? (
                <li className="px-2 py-4 text-center text-xs text-[var(--muted)]">No applications yet</li>
              ) : null}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
