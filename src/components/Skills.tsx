"use client";

import { motion, useReducedMotion } from "motion/react";
import { certifications, education, skills } from "@/content/resume";
import { Reveal } from "./Reveal";

export function Skills() {
  const reduce = useReducedMotion();

  return (
    <section id="skills" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">04</p>
          <h2 className="section-title">{skills.heading}</h2>
        </Reveal>

        <Reveal className="mt-8 flex flex-wrap gap-3" delay={0.05}>
          {skills.top.map((skill) => (
            <span
              key={skill}
              className="border border-[var(--accent)]/35 px-4 py-2 text-sm text-[var(--accent)]"
            >
              {skill}
            </span>
          ))}
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div className="grid gap-6 sm:grid-cols-2">
            {skills.groups.map((group, i) => (
              <Reveal key={group.label} delay={i * 0.06}>
                <div>
                  <h3 className="text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
                    {group.label}
                  </h3>
                  <ul className="mt-3 space-y-2 text-[var(--muted)]">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="space-y-8">
            {skills.meters.map((meter, i) => (
              <Reveal key={meter.name} delay={0.05 + i * 0.05}>
                <div>
                  <p className="mb-3 text-sm text-[var(--cream)]">{meter.name}</p>
                  <div className="relative h-1.5 rounded-full bg-white/10">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--cream)] to-[var(--accent)]"
                      initial={reduce ? { width: `${meter.width}%` } : { width: 0 }}
                      whileInView={{ width: `${meter.width}%` }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{
                        duration: 1.1,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.1,
                      }}
                    />
                    <motion.div
                      className="absolute top-full -translate-x-1/2 pt-1.5"
                      style={{ left: `${meter.width}%` }}
                      initial={reduce ? { opacity: 1 } : { opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.4, delay: 0.7 }}
                    >
                      <span
                        className="mx-auto block h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[var(--accent)]"
                        aria-hidden
                      />
                      <span className="mt-1 block whitespace-nowrap text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                        {meter.proficiency}
                      </span>
                    </motion.div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-2">
          <Reveal delay={0.08}>
            <h3 className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Certifications
            </h3>
            <ul className="mt-4 space-y-3">
              {certifications.map((cert) => (
                <li
                  key={cert}
                  className="border border-white/10 px-4 py-3 text-sm text-[var(--cream)]"
                >
                  {cert}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.12}>
            <h3 className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Education
            </h3>
            <ul className="mt-4 space-y-3">
              {education.map((ed) => (
                <li
                  key={ed.school}
                  className="border border-white/10 px-4 py-3 text-sm text-[var(--cream)]"
                >
                  <span className="block font-[family-name:var(--font-display)] text-lg">
                    {ed.school}
                  </span>
                  <span className="text-[var(--muted)]">
                    {ed.detail} · {ed.dates}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
