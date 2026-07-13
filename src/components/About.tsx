"use client";

import Image from "next/image";
import { about, portraits } from "@/content/resume";
import { Reveal } from "./Reveal";

export function About() {
  return (
    <section id="about" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">01</p>
          <h2 className="section-title">{about.heading}</h2>
        </Reveal>

        <div className="mt-14 grid items-center gap-10 md:grid-cols-12 md:gap-12">
          <Reveal className="relative md:col-span-5" delay={0.05}>
            <div className="relative aspect-[4/5] overflow-hidden bg-black">
              <Image
                src={portraits.close}
                alt="Chris Rosenau — portrait"
                fill
                priority
                className="object-cover object-[center_20%]"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            </div>
          </Reveal>

          <div className="space-y-6 md:col-span-6 md:col-start-7">
            <Reveal delay={0.08}>
              <p className="font-[family-name:var(--font-display)] text-3xl leading-snug tracking-tight text-[var(--cream)] md:text-4xl">
                Learning media that feels intentional — not templated.
              </p>
            </Reveal>
            {about.paragraphs.map((p, i) => (
              <Reveal key={i} delay={0.12 + i * 0.08}>
                <p className="text-lg leading-relaxed text-[var(--muted)]">{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
