"use client";

import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { useResume, useSectionNumber } from "@/components/resume/ResumeProvider";
import { Reveal } from "./Reveal";

export function Gallery() {
  const sectionNumber = useSectionNumber("work");
  const reduce = useReducedMotion();
  const { work } = useResume();
  const featured = work.featured.filter((f) => f.enabled);
  const cases = work.cases.filter((c) => c.enabled);
  const visuals = work.gallery.items.filter((v) => v.enabled && v.image);
  const study = work.study.enabled && work.study.title ? work.study : null;

  return (
    <section id="work" className="relative pt-2 pb-4 md:pt-2 md:pb-4 lg:pt-2 lg:pb-2">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">{sectionNumber}</p>
          <h2 className="section-title">{work.heading}</h2>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">{work.note}</p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3 print:grid-cols-3">
          {featured.map((item, i) => (
            <Reveal key={item.id} delay={0.06 + i * 0.04}>
              <div className="overflow-hidden border border-white/10">
                <div className="relative aspect-video bg-black">
                  {item.kind === "youtube" ? (
                    <iframe
                      src={item.embed}
                      title={item.label}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />
                  ) : (
                    <video
                      src={item.src}
                      autoPlay={!reduce}
                      loop
                      muted
                      playsInline
                      controls
                      preload="metadata"
                      aria-label={item.label}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="border-t border-white/10 px-4 py-4">
                  <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--cream)]">
                    {item.label}
                  </h3>
                  {item.detail ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
                  ) : null}
                  {item.tools ? (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--warm)]">
                      {item.tools}
                    </p>
                  ) : null}
                  {item.kind === "youtube" && item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm text-[var(--accent)] transition-colors hover:text-[var(--cream)]"
                    >
                      Open on YouTube
                    </a>
                  ) : null}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {visuals.length ? (
          <div id="visual-learning" className="mt-16 scroll-mt-24">
            <Reveal>
              <h3 className="font-[family-name:var(--font-display)] text-2xl text-[var(--cream)] sm:text-3xl">
                {work.gallery.heading}
              </h3>
              {work.gallery.note ? (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
                  {work.gallery.note}
                </p>
              ) : null}
            </Reveal>
            <div className="mt-8 grid gap-6 md:grid-cols-3 print:grid-cols-3">
              {visuals.map((v, i) => (
                <Reveal key={v.id} delay={0.05 + i * 0.04}>
                  <figure className="overflow-hidden border border-white/10">
                    <a
                      href={v.href || v.image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white"
                      aria-label={`Open ${v.title} full size`}
                    >
                      <Image
                        src={v.image}
                        alt={v.alt || v.title}
                        width={900}
                        height={1200}
                        unoptimized
                        loading="lazy"
                        className="h-auto w-full"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </a>
                    <figcaption className="border-t border-white/10 px-4 py-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--warm)]">
                        {v.tag}
                      </p>
                      <p className="mt-1 font-[family-name:var(--font-display)] text-lg text-[var(--cream)]">
                        {v.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{v.caption}</p>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        ) : null}

        {study ? (
          <Reveal className="mt-16" delay={0.05}>
            <article id="case-study" className="scroll-mt-24 border border-white/10 px-5 py-6 sm:px-8 sm:py-8">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--warm)]">{study.tag}</p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--cream)] sm:text-3xl">
                {study.title}
              </h3>
              <p className="mt-3 max-w-3xl text-[var(--muted)]">{study.summary}</p>
              <ol className="mt-6 grid gap-4 sm:grid-cols-2">
                {study.steps.map((step, i) => (
                  <li key={step.id} className="border-l border-[var(--accent)]/40 pl-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                      {String(i + 1).padStart(2, "0")} · {step.label}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{step.detail}</p>
                  </li>
                ))}
              </ol>
              {study.outcome ? (
                <p className="mt-6 border-t border-white/10 pt-4 text-sm leading-relaxed text-[var(--cream)]">
                  <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                    Outcome
                  </span>
                  {study.outcome}
                </p>
              ) : null}
            </article>
          </Reveal>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3 print:grid-cols-3">
          {cases.map((item, i) => (
            <Reveal key={item.id} delay={0.08 + i * 0.04}>
              <article className="border border-white/10 px-5 py-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--warm)]">
                  {item.tag}
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg text-[var(--cream)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.detail}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
