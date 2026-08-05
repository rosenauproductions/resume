"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { skillsNetwork } from "@/content/resume";

const VIEW_W = 1000;
const VIEW_H = 640;

function nodeRadius(kind: string) {
  if (kind === "hub") return 36;
  if (kind === "duty") return 30;
  return 24;
}

export function SkillsNetwork() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const byId = useMemo(() => {
    const map = new Map<string, (typeof skillsNetwork.nodes)[number]>();
    for (const n of skillsNetwork.nodes) map.set(n.id, n);
    return map;
  }, []);

  const linked = useMemo(() => {
    if (!active) return new Set<string>();
    const set = new Set<string>([active]);
    for (const [a, b] of skillsNetwork.edges) {
      if (a === active || b === active) {
        set.add(a);
        set.add(b);
      }
    }
    return set;
  }, [active]);

  return (
    <div className="relative overflow-hidden border border-white/10 bg-[var(--panel)]/40">
      <p className="absolute left-4 top-3 z-10 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
        Hover a node · skills · responsibilities
      </p>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full min-h-[320px] md:min-h-[420px]"
        role="img"
        aria-label="Network map of skills and responsibilities"
      >
        <defs>
          <radialGradient id="skills-net-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(63,208,201,0.2)" />
            <stop offset="100%" stopColor="rgba(63,208,201,0)" />
          </radialGradient>
        </defs>

        <circle cx={VIEW_W / 2} cy={VIEW_H / 2} r={220} fill="url(#skills-net-glow)" />

        {skillsNetwork.edges.map(([a, b]) => {
          const na = byId.get(a);
          const nb = byId.get(b);
          if (!na || !nb) return null;
          const lit = !active || (linked.has(a) && linked.has(b));
          return (
            <motion.line
              key={`${a}-${b}`}
              x1={(na.x / 100) * VIEW_W}
              y1={(na.y / 100) * VIEW_H}
              x2={(nb.x / 100) * VIEW_W}
              y2={(nb.y / 100) * VIEW_H}
              stroke={lit ? "rgba(63,208,201,0.55)" : "rgba(238,244,248,0.06)"}
              strokeWidth={lit && active ? 1.8 : 1}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          );
        })}

        {skillsNetwork.nodes.map((node, i) => {
          const cx = (node.x / 100) * VIEW_W;
          const cy = (node.y / 100) * VIEW_H;
          const r = nodeRadius(node.kind);
          const lit = !active || linked.has(node.id);
          const isHub = node.kind === "hub";
          const isDuty = node.kind === "duty";
          const fill = isHub
            ? "rgba(63,208,201,0.18)"
            : isDuty
              ? "rgba(232,163,92,0.16)"
              : "rgba(238,244,248,0.06)";
          const stroke = isHub
            ? "rgba(63,208,201,0.85)"
            : isDuty
              ? "rgba(232,163,92,0.75)"
              : "rgba(238,244,248,0.28)";

          return (
            <motion.g
              key={node.id}
              initial={reduce ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: lit ? 1 : 0.22, scale: 1 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.02 }}
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
                r={r + (active === node.id ? 4 : 0)}
                fill={fill}
                stroke={stroke}
                strokeWidth={active === node.id ? 2 : 1.25}
              />
              {node.label.split("\n").map((line, li, arr) => (
                <text
                  key={`${node.id}-${li}`}
                  x={cx}
                  y={cy + (li - (arr.length - 1) / 2) * 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  fill={lit ? "#eef4f8" : "#6b7f8f"}
                  style={{
                    fontSize: isHub ? 12 : 10,
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    fontWeight: isHub ? 600 : 500,
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
