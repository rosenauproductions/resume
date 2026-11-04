"use client";

import { useState } from "react";
import { useResume, useSectionNumber } from "@/components/resume/ResumeProvider";
import { Reveal } from "./Reveal";
import { ProjectNetwork } from "./ProjectNetwork";

export function SideProjects() {
  const sectionNumber = useSectionNumber("projects");
  const { sideProjects } = useResume();
  const allProjects = sideProjects.projects.filter((p) => p.enabled);
  const [showAll, setShowAll] = useState(false);
  const limit = sideProjects.initialCount ?? 0;
  const hidden = limit > 0 ? Math.max(0, allProjects.length - limit) : 0;
  const projects = hidden && !showAll ? allProjects.slice(0, limit) : allProjects;
  return (
    <section id="projects" className="relative pt-2 pb-4 md:pt-2 md:pb-4 lg:pt-2 lg:pb-2">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">{sectionNumber}</p>
          <h2 className="section-title">{sideProjects.heading}</h2>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">{sideProjects.note}</p>
        </Reveal>

        <Reveal className="mt-8" delay={0.05}>
          <ProjectNetwork />
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-3 print:grid-cols-3">
          {projects.map((project, i) => (
            <Reveal key={project.id} delay={0.05 + i * 0.05}>
              <article className="flex h-full flex-col border border-white/10 px-5 py-6">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                  {project.tags.join(" · ")}
                </p>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
                  {project.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                  {project.summary}
                </p>
                {project.href ? (
                  <a
                    href={project.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex self-start text-sm text-[var(--accent)] transition-colors hover:text-[var(--cream)]"
                  >
                    {project.linkLabel} →
                  </a>
                ) : project.linkLabel ? (
                  <p className="mt-5 text-xs text-[var(--muted)]">{project.linkLabel}</p>
                ) : null}
              </article>
            </Reveal>
          ))}
        </div>
        {hidden ? (
          <div className="mt-6 flex justify-center no-print">
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="rounded-full border border-white/20 px-5 py-2 text-sm text-[var(--cream)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {showAll ? "Show fewer" : `More builds (${hidden})`}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
