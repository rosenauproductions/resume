"use client";

import { useMemo, useState } from "react";
import { useResume } from "@/components/resume/ResumeProvider";
import { Reveal } from "./Reveal";

export function RoleFit() {
  const { roleFit, sideProjects } = useResume();
  const needs = useMemo(() => roleFit.needs.filter((n) => n.enabled !== false), [roleFit.needs]);
  const projectsById = useMemo(
    () => new Map(sideProjects.projects.filter((p) => p.enabled).map((p) => [p.id, p])),
    [sideProjects.projects],
  );

  const [selected, setSelected] = useState<string[]>(() => (needs[0] ? [needs[0].id] : []));

  const active = useMemo(
    () => needs.filter((need) => selected.includes(need.id)),
    [needs, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        // Keep at least one selected for a useful default view
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  if (!needs.length) return null;

  return (
    <section id="fit" className="relative pt-2 pb-4 md:pt-2 md:pb-4 lg:pt-2 lg:pb-2">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">06</p>
          <h2 className="section-title">{roleFit.heading}</h2>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">{roleFit.note}</p>
        </Reveal>

        <Reveal className="mt-8" delay={0.05}>
          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Hiring needs">
            {needs.map((need) => {
              const on = selected.includes(need.id);
              return (
                <button
                  key={need.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(need.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "border-white/15 text-[var(--muted)] hover:border-white/30 hover:text-[var(--cream)]"
                  }`}
                >
                  {need.label}
                </button>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-10 space-y-5">
          {active.map((need, i) => (
            <Reveal key={need.id} delay={0.04 + i * 0.04}>
              <article className="border border-white/10 px-5 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)] sm:text-2xl">
                    {need.label}
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                    {need.strength} fit
                  </span>
                </div>
                <p className="mt-3 max-w-3xl text-[var(--muted)]">{need.summary}</p>

                <ul className="mt-5 space-y-4">
                  {need.matches.map((match) => {
                    const project = match.projectId ? projectsById.get(match.projectId) : undefined;
                    const href = project?.href;
                    return (
                      <li
                        key={`${need.id}-${match.company}-${match.role}-${match.projectId ?? ""}`}
                        className="grid gap-1 border-l border-[var(--accent)]/40 pl-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-6"
                      >
                        <div>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[var(--cream)] transition-colors hover:text-[var(--accent)]"
                            >
                              {match.role}
                            </a>
                          ) : (
                            <p className="text-sm text-[var(--cream)]">{match.role}</p>
                          )}
                          <p className="text-xs text-[var(--accent)]">
                            {match.company || (project ? "Side project" : "")}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed text-[var(--muted)]">{match.proof}</p>
                      </li>
                    );
                  })}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
