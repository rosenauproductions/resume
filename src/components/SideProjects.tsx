"use client";

import { useResume } from "@/components/resume/ResumeProvider";
import { Reveal } from "./Reveal";
import { ProjectNetwork } from "./ProjectNetwork";

export function SideProjects() {
  const { sideProjects } = useResume();
  const projects = sideProjects.projects.filter((p) => p.enabled);
  return (
    <section id="projects" className="relative pt-2 pb-4 md:pt-2 md:pb-4 lg:pt-2 lg:pb-2">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">04</p>
          <h2 className="section-title">{sideProjects.heading}</h2>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">{sideProjects.note}</p>
        </Reveal>

        <Reveal className="mt-8" delay={0.05}>
          <ProjectNetwork />
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
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
                <a
                  href={project.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex self-start text-sm text-[var(--accent)] transition-colors hover:text-[var(--cream)]"
                >
                  {project.linkLabel} →
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
