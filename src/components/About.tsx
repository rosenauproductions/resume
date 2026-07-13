"use client";

import Image from "next/image";
import { about, portraits } from "@/content/resume";
import { Reveal } from "./Reveal";

export function About() {
  return (
    <section id="about" className="relative pt-16 pb-4 md:pt-20 md:pb-4 lg:pt-24 lg:pb-2">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">01</p>
          <h2 className="section-title">{about.heading}</h2>
        </Reveal>

        <Reveal className="mt-10 md:mt-14" delay={0.06}>
          <p className="mb-8 text-center font-[family-name:var(--font-display)] text-2xl leading-snug tracking-tight text-[var(--cream)] sm:text-3xl md:text-4xl">
            Learning media that feels intentional — not templated.
          </p>

          {/* Float portrait so body copy wraps around it on tablet+ */}
          <div className="about-flow">
            <div className="about-portrait">
              <Image
                src={portraits.close}
                alt="Chris Rosenau — portrait"
                width={808}
                height={1024}
                priority
                unoptimized
                className="h-auto w-full"
              />
            </div>

            {about.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="mb-5 text-base leading-relaxed text-[var(--muted)] last:mb-0 sm:text-lg">
                {p}
              </p>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
