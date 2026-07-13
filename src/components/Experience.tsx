"use client";

import { motion, useReducedMotion } from "motion/react";
import { experience } from "@/content/resume";
import { Reveal } from "./Reveal";

export function Experience() {
  const reduce = useReducedMotion();

  return (
    <section id="experience" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">02</p>
          <h2 className="section-title">Experience</h2>
        </Reveal>

        <div className="relative mt-16">
          <div
            className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-[var(--accent)] via-white/20 to-transparent md:left-[11px]"
            aria-hidden
          />

          <ol className="space-y-14">
            {experience.map((job, i) => (
              <li key={`${job.company}-${job.dates}`} className="relative pl-10 md:pl-14">
                {/* Marker stays put — no translate, just a soft fade */}
                <motion.span
                  className="absolute left-0 top-2 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--ink)] md:h-6 md:w-6"
                  aria-hidden
                  initial={reduce ? false : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.05 }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] md:h-2 md:w-2" />
                </motion.span>

                <Reveal delay={i * 0.05} distance={14} duration={0.85}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <div>
                      <h3 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--cream)]">
                        {job.role}
                      </h3>
                      <p className="mt-1 text-[var(--accent)]">{job.company}</p>
                    </div>
                    <p className="shrink-0 font-mono text-sm text-[var(--muted)]">
                      {job.dates}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>

                  <ul className="mt-5 space-y-3 text-[var(--muted)]">
                    {job.highlights.map((item) => (
                      <li key={item} className="flex gap-3 leading-relaxed">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--warm)]" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
