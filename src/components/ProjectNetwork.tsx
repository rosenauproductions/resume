"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { projectNetwork } from "@/content/resume";

const VIEW_W = 1000;
const VIEW_H = 620;

function nodeRadius(kind: string) {
  if (kind === "hub") return 40;
  if (kind === "craft") return 32;
  return 26;
}

function nodeColors(kind: string) {
  if (kind === "hub") {
    return { fill: "rgba(63,208,201,0.22)", stroke: "rgba(63,208,201,0.95)" };
  }
  if (kind === "craft") {
    return { fill: "rgba(232,163,92,0.16)", stroke: "rgba(232,163,92,0.8)" };
  }
  return { fill: "rgba(238,244,248,0.07)", stroke: "rgba(238,244,248,0.35)" };
}

export function ProjectNetwork() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const byId = useMemo(() => {
    const map = new Map<string, (typeof projectNetwork.nodes)[number]>();
    for (const n of projectNetwork.nodes) map.set(n.id, n);
    return map;
  }, []);

  const linked = useMemo(() => {
    if (!active) return new Set<string>();
    const set = new Set<string>([active]);
    for (const [a, b] of projectNetwork.edges) {
      if (a === active || b === active) {
        set.add(a);
        set.add(b);
      }
    }
    return set;
  }, [active]);

  return (
    <div className="site-network relative overflow-hidden border border-white/10 bg-[var(--panel)]/35">
      <p className="absolute left-4 top-3 z-10 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
        {projectNetwork.caption} · hover a node
      </p>
      <div className="absolute right-4 top-3 z-10 hidden gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] sm:flex">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Craft
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--cream)]/50" /> Project
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full min-h-[300px] text-[var(--cream)] md:min-h-[400px]"
        role="img"
        aria-label="Animated construction network of crafts and projects"
      >
        <defs>
          <radialGradient id="project-net-glow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(63,208,201,0.18)" />
            <stop offset="100%" stopColor="rgba(63,208,201,0)" />
          </radialGradient>
        </defs>

        <circle cx={VIEW_W / 2} cy={VIEW_H / 2} r={240} fill="url(#project-net-glow)" />

        {projectNetwork.edges.map(([a, b], ei) => {
          const na = byId.get(a);
          const nb = byId.get(b);
          if (!na || !nb) return null;
          const x1 = (na.x / 100) * VIEW_W;
          const y1 = (na.y / 100) * VIEW_H;
          const x2 = (nb.x / 100) * VIEW_W;
          const y2 = (nb.y / 100) * VIEW_H;
          const lit = !active || (linked.has(a) && linked.has(b));
          const len = Math.hypot(x2 - x1, y2 - y1);

          return (
            <g key={`${a}-${b}`}>
              <motion.line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={lit ? "rgba(63,208,201,0.35)" : "rgba(238,244,248,0.05)"}
                strokeWidth={lit && active ? 1.6 : 1}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: reduce ? 0 : ei * 0.01 }}
              />
              {!reduce ? (
                <motion.line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(63,208,201,0.5)"
                  strokeWidth={1.1}
                  strokeDasharray={`${Math.min(26, len * 0.1)} ${Math.max(40, len)}`}
                  initial={false}
                  animate={lit ? { strokeDashoffset: [0, -len] } : { strokeDashoffset: 0 }}
                  transition={{
                    duration: 3.2 + (ei % 4) * 0.4,
                    repeat: Infinity,
                    ease: "linear",
                    delay: (ei % 6) * 0.2,
                  }}
                  opacity={lit ? 0.65 : 0}
                />
              ) : null}
            </g>
          );
        })}

        {projectNetwork.nodes.map((node, i) => {
          const cx = (node.x / 100) * VIEW_W;
          const cy = (node.y / 100) * VIEW_H;
          const r = nodeRadius(node.kind);
          const lit = !active || linked.has(node.id);
          const colors = nodeColors(node.kind);
          const floatAmp = node.kind === "hub" ? 4 : node.kind === "craft" ? 5 : 6;

          return (
            <motion.g
              key={node.id}
              initial={reduce ? false : { opacity: 0, scale: 0.65 }}
              animate={
                reduce
                  ? { opacity: lit ? 1 : 0.22, scale: 1 }
                  : {
                      opacity: lit ? 1 : 0.2,
                      scale: 1,
                      y: [0, -floatAmp, 0, floatAmp * 0.6, 0],
                    }
              }
              transition={
                reduce
                  ? { duration: 0.3 }
                  : {
                      opacity: { duration: 0.35 },
                      scale: { duration: 0.35, delay: i * 0.015 },
                      y: {
                        duration: 5 + (i % 5) * 0.45,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: (i % 8) * 0.2,
                      },
                    }
              }
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              onMouseEnter={() => setActive(node.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(node.id)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              className="cursor-pointer outline-none"
            >
              <circle
                cx={cx}
                cy={cy}
                r={r + (active === node.id ? 5 : 0)}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={active === node.id ? 2.25 : 1.3}
              />
              {node.label.split("\n").map((line, li, arr) => (
                <text
                  key={`${node.id}-${li}`}
                  x={cx}
                  y={cy + (li - (arr.length - 1) / 2) * 11}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  fill="currentColor"
                  style={{
                    fontSize: node.kind === "hub" ? 12 : node.kind === "craft" ? 10 : 9,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    letterSpacing: "0.04em",
                  }}
                >
                  {line}
                </text>
              ))}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
