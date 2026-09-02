"use client";

import { useMemo, useState } from "react";
import type { JobApplication } from "@/lib/jobs/types";
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
};

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
};

type UnlinkedPin = {
  cityKey: string;
  label: string;
  x: number;
  y: number;
  count: number;
};

function hitRadius(hits: number, maxHits: number) {
  if (hits <= 0) return 5;
  const t = Math.min(1, hits / Math.max(1, maxHits));
  return 6 + t * 14;
}

function hitOpacity(hits: number, maxHits: number) {
  if (hits <= 0) return 0.45;
  const t = Math.min(1, hits / Math.max(1, maxHits));
  return 0.55 + t * 0.45;
}

function edgeStroke(hits: number, maxHits: number) {
  if (hits <= 0) return { width: 0.6, opacity: 0.12 };
  const t = Math.min(1, hits / Math.max(1, maxHits));
  return { width: 0.8 + t * 3.2, opacity: 0.2 + t * 0.55 };
}

function remoteDotRadius(hits: number, maxHits: number) {
  if (hits <= 0) return 4;
  const t = Math.min(1, hits / Math.max(1, maxHits));
  return 4.5 + t * 8;
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

  const hub = useMemo(() => {
    const p = projectUS(RESUME_HUB.lng, RESUME_HUB.lat);
    return p ? { ...RESUME_HUB, ...p } : { ...RESUME_HUB, x: 500, y: 350 };
  }, []);

  const { targets, unlinked, maxHits, geoTargets, remoteTargets, remoteCount, totalHits } =
    useMemo(() => {
      const activeVisits = visits.filter((v) => v.linkConfidence !== "ignored");

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

      return { targets: nodes, unlinked, maxHits, geoTargets, remoteTargets, remoteCount, totalHits };
    }, [jobs, visits]);

  const visibleGeo = showZero ? geoTargets : geoTargets.filter((t) => t.hits > 0);
  const visibleRemote = showZero ? remoteTargets : remoteTargets.filter((t) => t.hits > 0);
  const visibleTargets = [...visibleGeo, ...visibleRemote];
  const hovered = hoverId ? targets.find((t) => t.job.id === hoverId) : null;
  const ranked = [...targets].sort((a, b) => b.hits - a.hits || a.job.company.localeCompare(b.job.company));

  const { boxX, boxY, boxW, boxH, label: remoteLabel } = REMOTE_CLUSTER;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
            Target map
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Applications as targets · resume visits as hits. Stronger glow and thicker links mean more
            linked or city-suggested views. Remote and unplaced roles sit in the Mexico-side cluster.
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
              <style>{`
                @keyframes target-pulse {
                  0%, 100% { transform: scale(1); opacity: 0.4; }
                  50% { transform: scale(2.2); opacity: 0.05; }
                }
                .pulse-ring {
                  animation: target-pulse 2.4s ease-in-out infinite;
                  fill: var(--accent);
                  transform-box: fill-box;
                  transform-origin: center;
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
              ? visibleTargets.map((t) => {
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

            {showUnlinked
              ? unlinked.map((u) => (
                  <g key={`u-${u.cityKey}`} opacity={0.85}>
                    <circle
                      cx={u.x}
                      cy={u.y}
                      r={4 + Math.min(8, u.count * 1.5)}
                      fill="color-mix(in oklab, var(--muted) 55%, transparent)"
                      stroke="color-mix(in oklab, var(--muted) 80%, white)"
                      strokeWidth={1}
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

            {visibleGeo.map((t) => {
              const r = hitRadius(t.hits, maxHits);
              const op = hitOpacity(t.hits, maxHits);
              const active = hoverId === t.job.id;
              const color = t.hits > 0 ? "var(--accent)" : "color-mix(in oklab, var(--warm) 70%, var(--muted))";
              return (
                <g
                  key={t.job.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverId(t.job.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => onSelectJob(t.job)}
                  opacity={hoverId && !active ? 0.35 : 1}
                >
                  {t.hits >= 2 ? (
                    <circle className="pulse-ring" cx={t.x} cy={t.y} r={12} style={{ animationDelay: `${(t.hits % 5) * 0.2}s` }} />
                  ) : null}
                  <circle
                    cx={t.x}
                    cy={t.y}
                    r={r}
                    fill={color}
                    fillOpacity={op}
                    stroke={active ? "var(--cream)" : "color-mix(in oklab, var(--ink) 40%, transparent)"}
                    strokeWidth={active ? 2 : 1}
                    filter={t.hits > 0 ? "url(#hit-glow)" : undefined}
                  />
                  {(active || t.hits > 0) && (
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
                  )}
                  <title>
                    {`${t.job.company} — ${t.job.title}\n${t.geoLabel}\n${t.hits} hit${t.hits === 1 ? "" : "s"} (${t.linkedHits} linked · ${t.suggestedHits} suggested)`}
                  </title>
                </g>
              );
            })}

            {visibleRemote.map((t) => {
              const r = remoteDotRadius(t.hits, maxHits);
              const op = hitOpacity(t.hits, maxHits);
              const active = hoverId === t.job.id;
              const color = t.hits > 0 ? "var(--accent)" : "color-mix(in oklab, var(--warm) 75%, var(--muted))";
              return (
                <g
                  key={t.job.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverId(t.job.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => onSelectJob(t.job)}
                  opacity={hoverId && !active ? 0.4 : 1}
                >
                  {t.hits >= 2 ? (
                    <circle
                      className="pulse-ring"
                      cx={t.x}
                      cy={t.y}
                      r={8}
                      style={{ animationDelay: `${(t.hits % 5) * 0.2}s` }}
                    />
                  ) : null}
                  <circle
                    cx={t.x}
                    cy={t.y}
                    r={r}
                    fill={color}
                    fillOpacity={op}
                    stroke={active ? "var(--cream)" : "color-mix(in oklab, var(--ink) 35%, transparent)"}
                    strokeWidth={active ? 1.8 : 0.9}
                    filter={t.hits > 0 ? "url(#hit-glow)" : undefined}
                  />
                  <title>
                    {`${t.job.company} — ${t.job.title}\n${t.geoLabel}\n${t.hits} hit${t.hits === 1 ? "" : "s"} (${t.linkedHits} linked · ${t.suggestedHits} suggested)`}
                  </title>
                </g>
              );
            })}
          </svg>

          {hovered ? (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-[var(--ink)]/90 px-3 py-2 text-sm backdrop-blur sm:right-auto sm:max-w-sm">
              <p className="font-medium text-[var(--cream)]">{hovered.job.company}</p>
              <p className="text-xs text-[var(--muted)]">{hovered.job.title}</p>
              <p className="mt-1 text-xs text-[var(--accent)]">
                {hovered.hits} hit{hovered.hits === 1 ? "" : "s"} · {hovered.geoLabel}
                {hovered.linkedHits || hovered.suggestedHits
                  ? ` · ${hovered.linkedHits} linked / ${hovered.suggestedHits} suggested`
                  : " · no visits yet"}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">Click to open job detail</p>
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
                <span className="inline-block h-3 w-3 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                Target with hits (size ∝ views)
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--warm)] opacity-70" />
                Target, 0 hits
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex h-4 w-7 items-center justify-center rounded border border-[color-mix(in_oklab,var(--warm)_45%,var(--cream))] bg-[color-mix(in_oklab,var(--ink)_40%,transparent)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--warm)]" />
                </span>
                Remote / no location
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--muted)] opacity-60" />
                Unlinked visit city
              </li>
              <li className="flex items-center gap-2">
                <span className="h-0.5 w-6 bg-[var(--accent)] opacity-70" />
                Link weight ∝ hit count
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
                      <span className="text-[var(--cream)]">{t.job.shortName || t.job.company}</span>
                      <span className="block truncate text-[10px] text-[var(--muted)]">
                        {t.remote ? `Remote · ${t.geoLabel}` : t.geoLabel}
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
