import { site } from "@/content/resume";
import { Reveal } from "./Reveal";

export function Contact() {
  return (
    <section id="contact" className="relative py-28 md:py-40">
      <div className="absolute inset-0 contact-glow" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <Reveal>
          <p className="section-kicker justify-center">05</p>
          <h2 className="section-title">Let’s connect</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--muted)]">
            {site.location} · Open to instructional design, eLearning, corporate training,
            and multimedia production.
          </p>
        </Reveal>

        <Reveal
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          delay={0.1}
        >
          <a
            href={`mailto:${site.email}`}
            className="min-w-[240px] rounded-full bg-[var(--cream)] px-8 py-4 text-sm font-semibold text-[var(--ink)] transition-transform hover:scale-[1.03]"
          >
            {site.email}
          </a>
          <a
            href={site.phoneHref}
            className="min-w-[240px] rounded-full border border-white/20 px-8 py-4 font-mono text-sm text-[var(--cream)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {site.phone}
          </a>
        </Reveal>

        <Reveal className="mt-10" delay={0.15}>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
          >
            {site.linkedinLabel}
          </a>
        </Reveal>
      </div>

      <footer className="relative mx-auto mt-24 max-w-6xl border-t border-white/10 px-6 pt-8 text-center text-sm text-[var(--muted)]">
        <p>
          © {new Date().getFullYear()} {site.name}
        </p>
      </footer>
    </section>
  );
}
