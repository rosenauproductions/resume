import { work } from "@/content/resume";
import { Reveal } from "./Reveal";

export function Gallery() {
  return (
    <section id="work" className="relative pt-2 pb-4 md:pt-2 md:pb-4 lg:pt-2 lg:pb-2">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="section-kicker">03</p>
          <h2 className="section-title">{work.heading}</h2>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">{work.note}</p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {work.featured.map((item, i) => (
            <Reveal key={item.label} delay={0.06 + i * 0.04}>
              <div className="overflow-hidden border border-white/10">
                <div className="relative aspect-video bg-black">
                  {item.kind === "youtube" ? (
                    <iframe
                      src={item.embed}
                      title={item.label}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />
                  ) : (
                    <video
                      src={item.src}
                      autoPlay
                      loop
                      muted
                      playsInline
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
                  {item.kind === "youtube" ? (
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

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {work.cases.map((item, i) => (
            <Reveal key={item.title} delay={0.08 + i * 0.04}>
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
