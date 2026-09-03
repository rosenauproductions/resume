"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  STATUS_LABELS,
  normalizeWorkType,
  type JobApplication,
  type JobStatus,
} from "@/lib/jobs/types";
import {
  CITY_COMPANY_ALIASES,
  MAP_SIZE,
  REMOTE_CLUSTER,
  RESUME_HUB,
  companyMatchesAliases,
  extractCityKey,
  isInEurope,
  isRemoteLocation,
  jitterOffset,
  lookupCity,
  packRemoteClusterPoint,
  projectUS,
} from "@/lib/pipeline/geo-cities";
import {
  EU_LAND_PATHS,
  EU_MAP_VIEWBOX,
  projectEU,
} from "@/lib/pipeline/eu-map-paths";
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
type MapLayer = "us" | "eu";

type RadarGlow = {
  id: string;
  x: number;
  y: number;
  count: number;
  tone: RadarTone;
  layer: MapLayer;
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
  layer: MapLayer;
};

type UnlinkedPin = {
  cityKey: string;
  label: string;
  x: number;
  y: number;
  count: number;
  layer: MapLayer;
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.25;
const ZOOM_STEP = 0.4;
const MAP_CX = MAP_SIZE.width / 2;
const MAP_CY = MAP_SIZE.height / 2;

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
      return { tier, baseR: 14, fillOp: 0.07, strokeOp: 0.18, rings: 1, duration: 3.4, pulse: false };
    case 2:
      return { tier, baseR: 20, fillOp: 0.12, strokeOp: 0.32, rings: 2, duration: 2.9, pulse: true };
    case 3:
      return { tier, baseR: 28, fillOp: 0.18, strokeOp: 0.45, rings: 2, duration: 2.4, pulse: true };
    case 4:
      return { tier, baseR: 38, fillOp: 0.26, strokeOp: 0.58, rings: 3, duration: 2.0, pulse: true };
  }
}

function isPipelineSelfVisit(v: MapVisit): boolean {
  const path = (v.path || "").trim();
  if (path === "/pipeline" || path.startsWith("/pipeline/")) return true;
  const reason = (v.linkReason || "").toLowerCase();
  return reason.includes("pipeline self-visit");
}

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function renderRadarGlow(g: RadarGlow, scale = 1, softId = "radar-soft") {
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
    const r = p.baseR * scale * (0.55 + i * 0.35);
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
        strokeWidth={(1.1 + i * 0.25) * scale}
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
        r={p.baseR * scale * 0.72}
        fill={fill}
        fillOpacity={p.fillOp}
        filter={`url(#${softId})`}
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [linksDrawn, setLinksDrawn] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const hub = useMemo(() => {
    const p = projectUS(RESUME_HUB.lng, RESUME_HUB.lat);
    return p ? { ...RESUME_HUB, ...p } : { ...RESUME_HUB, x: 500, y: 350 };
  }, []);

  const {
    targets,
    unlinked,
    maxHits,
    geoTargets,
    remoteTargets,
    euTargets,
    euUnlinked,
    remoteCount,
    totalHits,
    radarGlows,
    euRadarGlows,
  } = useMemo(() => {
    const activeVisits = visits.filter(
      (v) => v.linkConfidence !== "ignored" && !isPipelineSelfVisit(v),
    );

    const cityBuckets = new Map<string, MapVisit[]>();
    for (const v of activeVisits) {
      const key = extractCityKey(v.locationLabel) || extractCityKey(v.city);
      if (!key) continue;
      const list = cityBuckets.get(key) ?? [];
      list.push(v);
      cityBuckets.set(key, list);
    }

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
        const vKey = extractCityKey(v.locationLabel) || extractCityKey(v.city);
        if (!vKey) continue;
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

      if (geo) {
        const us = projectUS(geo.lng, geo.lat);
        if (us) {
          const idx = byCityIndex.get(geo.label) ?? 0;
          byCityIndex.set(geo.label, idx + 1);
          const jitter = jitterOffset(job.id || job.company, idx);
          nodes.push({
            job,
            cityKey,
            geoLabel: geo.label,
            x: us.x + jitter.dx,
            y: us.y + jitter.dy,
            hits,
            linkedHits,
            suggestedHits,
            remote: false,
            workType: inferWorkType(job, false),
            strokeKind: strokeKindFor(job.status, hits),
            layer: "us",
          });
          continue;
        }

        if (isInEurope(geo.lng, geo.lat)) {
          const eu = projectEU(geo.lng, geo.lat);
          if (eu) {
            const idx = byCityIndex.get(`eu:${geo.label}`) ?? 0;
            byCityIndex.set(`eu:${geo.label}`, idx + 1);
            const jitter = jitterOffset(job.id || job.company, idx);
            nodes.push({
              job,
              cityKey,
              geoLabel: geo.label,
              x: eu.x + jitter.dx * 0.35,
              y: eu.y + jitter.dy * 0.35,
              hits,
              linkedHits,
              suggestedHits,
              remote: false,
              workType: inferWorkType(job, false),
              strokeKind: strokeKindFor(job.status, hits),
              layer: "eu",
            });
            continue;
          }
        }
      }

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
        layer: "us",
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

      const us = projectUS(geo.lng, geo.lat);
      if (us) {
        unlinked.push({
          cityKey,
          label: geo.label,
          x: us.x,
          y: us.y,
          count: remaining.length,
          layer: "us",
        });
        continue;
      }

      if (isInEurope(geo.lng, geo.lat)) {
        const eu = projectEU(geo.lng, geo.lat);
        if (eu) {
          unlinked.push({
            cityKey,
            label: geo.label,
            x: eu.x,
            y: eu.y,
            count: remaining.length,
            layer: "eu",
          });
        }
      }
    }

    const geoTargets = nodes.filter((n) => !n.remote && n.layer === "us");
    const euTargets = nodes.filter((n) => n.layer === "eu");
    const remoteTargets = nodes.filter((n) => n.remote);
    const euUnlinked = unlinked.filter((u) => u.layer === "eu");
    const usUnlinked = unlinked.filter((u) => u.layer === "us");
    const maxHits = Math.max(
      1,
      ...nodes.map((n) => n.hits),
      ...unlinked.map((u) => u.count),
    );
    const totalHits = nodes.reduce((s, n) => s + n.hits, 0);

    const radarGlows: RadarGlow[] = [
      ...nodes
        .filter((n) => n.hits > 0 && n.layer === "us")
        .map((n) => ({
          id: `glow-job-${n.job.id}`,
          x: n.x,
          y: n.y,
          count: n.hits,
          tone: "job" as const,
          layer: "us" as const,
        })),
      ...usUnlinked.map((u) => ({
        id: `glow-city-${u.cityKey}`,
        x: u.x,
        y: u.y,
        count: u.count,
        tone: "city" as const,
        layer: "us" as const,
      })),
    ];

    const euRadarGlows: RadarGlow[] = [
      ...euTargets
        .filter((n) => n.hits > 0)
        .map((n) => ({
          id: `glow-eu-job-${n.job.id}`,
          x: n.x,
          y: n.y,
          count: n.hits,
          tone: "job" as const,
          layer: "eu" as const,
        })),
      ...euUnlinked.map((u) => ({
        id: `glow-eu-city-${u.cityKey}`,
        x: u.x,
        y: u.y,
        count: u.count,
        tone: "city" as const,
        layer: "eu" as const,
      })),
    ];

    return {
      targets: nodes,
      unlinked: usUnlinked,
      maxHits,
      geoTargets,
      remoteTargets,
      euTargets,
      euUnlinked,
      remoteCount,
      totalHits,
      radarGlows,
      euRadarGlows,
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
  const visibleEu = (showZero ? euTargets : euTargets.filter((t) => t.hits > 0)).filter(
    (t) => !dimNonMatch || filterPass(t),
  );
  const allGeoDraw = showZero ? geoTargets : geoTargets.filter((t) => t.hits > 0);
  const allRemoteDraw = showZero ? remoteTargets : remoteTargets.filter((t) => t.hits > 0);
  const allEuDraw = showZero ? euTargets : euTargets.filter((t) => t.hits > 0);
  const drawGeo = dimNonMatch ? allGeoDraw : visibleGeo;
  const drawRemote = dimNonMatch ? allRemoteDraw : visibleRemote;
  const drawEu = dimNonMatch ? allEuDraw : visibleEu;
  const edgeTargets = [...visibleGeo, ...visibleRemote];

  useEffect(() => {
    if (reducedMotion) {
      setLinksDrawn(true);
      return;
    }
    setLinksDrawn(false);
    const count = Math.min(edgeTargets.length, 36);
    const delay = Math.min(2200, 700 + count * 45);
    const t = window.setTimeout(() => setLinksDrawn(true), delay);
    return () => window.clearTimeout(t);
  }, [reducedMotion, edgeTargets.length, jobs.length]);

  const hovered = hoverId ? targets.find((t) => t.job.id === hoverId) : null;
  const ranked = [...targets]
    .filter((t) => filterPass(t))
    .sort((a, b) => b.hits - a.hits || a.job.company.localeCompare(b.job.company));

  const { boxX, boxY, boxW, boxH, label: remoteLabel } = REMOTE_CLUSTER;
  const animatingLinks = showEdges && !reducedMotion && !linksDrawn;
  const canPan = zoom > 1.02;

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setZoom((prev) => {
      const next = clampZoom(prev + delta);
      if (next <= 1.01) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * MAP_SIZE.width;
    const sy = ((e.clientY - rect.top) / rect.height) * MAP_SIZE.height;
    const delta = e.deltaY > 0 ? -ZOOM_STEP * 0.5 : ZOOM_STEP * 0.5;
    setZoom((prev) => {
      const next = clampZoom(prev + delta);
      setPan((p) => {
        if (next <= 1.01) return { x: 0, y: 0 };
        const worldX = (sx - MAP_CX - p.x) / prev + MAP_CX;
        const worldY = (sy - MAP_CY - p.y) / prev + MAP_CY;
        return {
          x: sx - MAP_CX - (worldX - MAP_CX) * next,
          y: sy - MAP_CY - (worldY - MAP_CY) * next,
        };
      });
      return next;
    });
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!canPan || e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = MAP_SIZE.width / rect.width;
    const scaleY = MAP_SIZE.height / rect.height;
    setPan({
      x: drag.originX + (e.clientX - drag.startX) * scaleX,
      y: drag.originY + (e.clientY - drag.startY) * scaleY,
    });
  };

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  function renderTargetDot(t: TargetNode, kind: "geo" | "remote" | "eu") {
    const scale = kind === "eu" ? 0.55 : 1;
    const r =
      (kind === "geo" || kind === "eu" ? hitRadius(t.hits, maxHits) : remoteDotRadius(t.hits, maxHits)) *
      scale;
    const op = hitOpacity(t.hits, maxHits);
    const active = hoverId === t.job.id;
    const matched = filterPass(t);
    const faded = dimNonMatch && !matched;
    const fill = FILL[t.workType];
    const stroke = STROKE[t.strokeKind];
    const sw = targetStrokeWidth(t.hits, active) * (kind === "eu" ? 0.85 : 1);

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
            r={Math.max(r + 3 * scale, 6 * scale)}
            fill={stroke}
            fillOpacity={0.08 + Math.min(0.14, t.hits * 0.03)}
            filter={kind === "eu" ? "url(#eu-radar-soft)" : "url(#radar-soft)"}
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
          filter={
            t.hits > 0 && !faded
              ? kind === "eu"
                ? "url(#eu-hit-glow)"
                : "url(#hit-glow)"
              : undefined
          }
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

  const layerTransform = `translate(${MAP_CX + pan.x} ${MAP_CY + pan.y}) scale(${zoom}) translate(${-MAP_CX} ${-MAP_CY})`;

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
            Remote and unplaced roles sit in the Mexico-side cluster; Europe pins live in the EU inset.
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
            ref={svgRef}
            viewBox={US_MAP_VIEWBOX}
            className={`relative z-[1] h-auto w-full ${canPan ? "cursor-grab active:cursor-grabbing" : ""}`}
            role="img"
            aria-label="US map of job targets and resume visit hits"
            onWheel={handleWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
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
                @keyframes link-draw {
                  from { stroke-dashoffset: 1; }
                  to { stroke-dashoffset: 0; }
                }
                .link-draw {
                  stroke-dasharray: 1;
                  stroke-dashoffset: 1;
                  animation: link-draw 0.95s ease-out forwards;
                }
                @media (prefers-reduced-motion: reduce) {
                  .radar-ring {
                    animation: none !important;
                    opacity: 0.55;
                  }
                  .link-draw {
                    animation: none !important;
                    stroke-dashoffset: 0;
                  }
                }
              `}</style>
            </defs>

            <g className="us-zoom-layer" transform={layerTransform}>
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
                ? edgeTargets.map((t, i) => {
                    const edge = edgeStroke(t.hits, maxHits);
                    return (
                      <line
                        key={`edge-${t.job.id}`}
                        className={animatingLinks ? "link-draw" : undefined}
                        x1={hub.x}
                        y1={hub.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={t.hits > 0 ? "var(--accent)" : "color-mix(in oklab, var(--muted) 50%, transparent)"}
                        strokeWidth={edge.width}
                        strokeOpacity={hoverId && hoverId !== t.job.id ? edge.opacity * 0.25 : edge.opacity}
                        strokeLinecap="round"
                        pathLength={animatingLinks ? 1 : undefined}
                        style={animatingLinks ? { animationDelay: `${Math.min(i, 35) * 42}ms` } : undefined}
                        pointerEvents="none"
                      />
                    );
                  })
                : null}

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
            </g>
          </svg>

          {/* EU mini-map — NE corner, outside US zoom transform */}
          <div className="pointer-events-auto absolute right-3 top-3 z-[3] w-[min(42%,11.5rem)] overflow-hidden rounded-xl border border-white/12 bg-[var(--ink)]/88 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex items-center justify-between px-2 pt-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
                EU
              </span>
              <span className="text-[9px] tabular-nums text-[var(--muted)]/80">
                {euTargets.length + euUnlinked.length}
              </span>
            </div>
            <svg
              viewBox={EU_MAP_VIEWBOX}
              className="h-auto w-full px-1 pb-1"
              role="img"
              aria-label="Europe inset of job targets and resume visits"
            >
              <defs>
                <filter id="eu-hit-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="eu-radar-soft" x="-120%" y="-120%" width="340%" height="340%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                  </feMerge>
                </filter>
              </defs>
              <rect
                x={0}
                y={0}
                width={280}
                height={220}
                fill="color-mix(in oklab, var(--panel) 70%, var(--ink))"
              />
              {EU_LAND_PATHS.map((p) => (
                <path
                  key={p.id}
                  d={p.d}
                  fill="color-mix(in oklab, var(--cream) 8%, var(--panel))"
                  stroke="color-mix(in oklab, var(--cream) 16%, transparent)"
                  strokeWidth={0.8}
                />
              ))}
              <g aria-hidden>
                {euRadarGlows
                  .filter((g) => {
                    if (g.tone === "city" && !showUnlinked) return false;
                    if (dimNonMatch && g.tone === "job") {
                      const t = euTargets.find((n) => `glow-eu-job-${n.job.id}` === g.id);
                      if (t && !filterPass(t)) return false;
                    }
                    return true;
                  })
                  .map((g) => renderRadarGlow(g, 0.55, "eu-radar-soft"))}
              </g>
              {showUnlinked
                ? euUnlinked.map((u) => (
                    <g key={`eu-u-${u.cityKey}`} opacity={0.85}>
                      <circle
                        cx={u.x}
                        cy={u.y}
                        r={3.5 + Math.min(5, u.count * 1.1)}
                        fill="color-mix(in oklab, var(--muted) 55%, transparent)"
                        stroke="color-mix(in oklab, var(--muted) 80%, white)"
                        strokeWidth={0.9}
                      />
                      <title>{`${u.label}: ${u.count} unlinked visit${u.count === 1 ? "" : "s"}`}</title>
                    </g>
                  ))
                : null}
              {drawEu.map((t) => renderTargetDot(t, "eu"))}
              {!euTargets.length && !euUnlinked.length ? (
                <text
                  x={140}
                  y={118}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize={11}
                  opacity={0.65}
                >
                  No EU pins yet
                </text>
              ) : null}
            </svg>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 z-[3] flex flex-col gap-1">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(ZOOM_STEP)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[var(--ink)]/85 text-lg text-[var(--cream)] backdrop-blur hover:border-[var(--accent)]"
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[var(--ink)]/85 text-lg text-[var(--cream)] backdrop-blur hover:border-[var(--accent)] disabled:opacity-35"
            >
              −
            </button>
            {zoom > 1.02 ? (
              <button
                type="button"
                aria-label="Reset zoom"
                onClick={resetView}
                className="mt-0.5 rounded-lg border border-white/15 bg-[var(--ink)]/85 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] backdrop-blur hover:border-[var(--accent)] hover:text-[var(--cream)]"
              >
                Reset
              </button>
            ) : null}
          </div>

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
            <div className="pointer-events-none absolute bottom-3 left-3 right-24 z-[2] rounded-xl border border-white/10 bg-[var(--ink)]/92 px-3 py-2.5 text-sm backdrop-blur sm:right-auto sm:max-w-sm">
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
                {hovered.layer === "eu" ? (
                  <>
                    <span className="text-[var(--muted)]">·</span>
                    <span className="text-[var(--muted)]">EU</span>
                  </>
                ) : null}
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
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-3.5 rounded-sm border border-white/20 bg-[var(--ink)]" />
                EU inset (NE)
              </li>
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
              {geoTargets.length} US · {euTargets.length} EU · {remoteCount} remote/unplaced · {totalHits}{" "}
              attributed hits
              {unlinked.length || euUnlinked.length
                ? ` · ${[...unlinked, ...euUnlinked].reduce((s, u) => s + u.count, 0)} unlinked`
                : ""}
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
                        {t.remote
                          ? `Remote · ${t.geoLabel}`
                          : t.layer === "eu"
                            ? `EU · ${t.geoLabel}`
                            : t.geoLabel}
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
