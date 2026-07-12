import { work } from "@/content/resume";
import { Reveal } from "./Reveal";

export function Gallery() {
  return (
    <section id="work" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">03</p>
          <h2 className="section-title">{work.heading}</h2>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">{work.note}</p>
        </Reveal>

        <Reveal className="mt-12" delay={0.08}>
          <div className="overflow-hidden border border-white/10">
            <div className="relative aspect-video bg-black">
              <iframe
                src={work.portfolioVideo.embed}
                title={work.portfolioVideo.label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
                  {work.portfolioVideo.label}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {work.portfolioVideo.detail}
                </p>
              </div>
              <a
                href={work.portfolioVideo.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full border border-white/20 px-5 py-2.5 text-sm text-[var(--cream)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Open on YouTube
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
