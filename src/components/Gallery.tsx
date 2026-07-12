"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { gallery } from "@/content/resume";
import { Reveal } from "./Reveal";

export function Gallery() {
  const reduce = useReducedMotion();

  return (
    <section id="studio" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">03</p>
          <h2 className="section-title">{gallery.heading}</h2>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">{gallery.note}</p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3 md:gap-5">
          {gallery.items.map((item, i) => (
            <Reveal key={item.src} delay={i * 0.08}>
              <figure className="group relative aspect-[3/4] overflow-hidden bg-black">
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                {!reduce && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(7,16,24,0.75), transparent 45%)",
                    }}
                    aria-hidden
                  />
                )}
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
