"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { portraits, site } from "@/content/resume";

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-end overflow-hidden pb-16 pt-28 md:items-center md:pb-0"
    >
      <Image
        src={portraits.texture}
        alt=""
        fill
        priority
        className="object-cover opacity-35"
        sizes="100vw"
      />
      <div className="absolute inset-0 hero-plane" aria-hidden />
      <div className="absolute inset-0 hero-vignette" aria-hidden />

      {!reduce && (
        <motion.div
          className="hero-orb absolute right-[10%] top-[18%] h-[360px] w-[360px] rounded-full"
          animate={{ y: [0, -22, 0], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      )}

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-end gap-8 px-6 md:grid-cols-12 md:items-center">
        <div className="md:col-span-7">
          <motion.p
            className="mb-5 text-sm uppercase tracking-[0.28em] text-[var(--accent)]"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {site.location}
          </motion.p>

          <motion.h1
            className="font-[family-name:var(--font-display)] text-[clamp(3.1rem,11vw,7.5rem)] leading-[0.9] tracking-[-0.03em] text-[var(--cream)]"
            initial={reduce ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          >
            {site.name}
          </motion.h1>

          <motion.p
            className="mt-6 max-w-lg text-lg text-[var(--muted)] md:text-xl"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <span className="block text-[var(--cream)]">{site.title}</span>
            <span className="mt-1 block text-base text-[var(--muted)]">{site.subtitle}</span>
            <span className="mt-4 block">{site.tagline}</span>
          </motion.p>

          <motion.div
            className="mt-10 flex flex-wrap gap-4"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.55 }}
          >
            <a
              href="#experience"
              className="rounded-full bg-[var(--cream)] px-7 py-3.5 text-sm font-semibold text-[var(--ink)] transition-transform hover:scale-[1.03]"
            >
              View experience
            </a>
            <a
              href={site.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-[var(--cream)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              LinkedIn
            </a>
          </motion.div>
        </div>

        <motion.div
          className="relative mx-auto w-full max-w-md md:col-span-5 md:max-w-none"
          initial={reduce ? false : { opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
        >
          <div className="relative aspect-[3/4]">
            <Image
              src={portraits.hero}
              alt={`${site.name} portrait`}
              fill
              priority
              className="object-contain object-bottom"
              sizes="(max-width: 768px) 90vw, 40vw"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
