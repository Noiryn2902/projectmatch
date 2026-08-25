'use client';

import Reveal from './Reveal';

/**
 * The hero clip comes back here, tinted rather than repeated plainly. It is
 * already downloaded by this point in the page, so the second appearance
 * costs nothing and closes the loop the page opened with.
 */
export default function BigCta() {
  return (
    <section className="mx-auto max-w-[1180px] xl:max-w-[1400px] px-5 pb-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/media/hero.webp"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-105 object-cover"
          >
            <source src="/media/hero.mp4" type="video/mp4" />
          </video>

          {/* Colour wash across all four accents, so the one big saturated
              block on the page is not a single hue. */}
          <div
            aria-hidden
            className="absolute inset-0 mix-blend-color"
            style={{
              background:
                'linear-gradient(115deg, #e8b04a 0%, #f0785a 30%, #a78bfa 62%, #5fd39a 100%)',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 66% at 50% 50%, rgba(8,9,12,0.82) 0%, rgba(8,9,12,0.62) 55%, rgba(8,9,12,0.4) 100%)',
            }}
          />

          <div className="relative px-6 py-16 text-center sm:px-12">
            <p className="pm-legible font-display text-[11px] tracking-[0.22em] text-accent uppercase">
              Ready when you are
            </p>
            <h2 className="pm-legible mt-4 font-display text-[26px] leading-tight font-bold tracking-tight text-white sm:text-[36px]">
              Describe the project. Get the team.
            </h2>
            <p className="pm-legible mx-auto mt-4 max-w-[460px] text-[14.5px] leading-relaxed font-medium text-white/90">
              Two lines is enough. No account, no database, nothing to install.
            </p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="mt-9 rounded-xl bg-accent px-7 py-3 text-[14px] font-medium text-canvas transition-transform hover:scale-[1.02]"
            >
              Start with your brief
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
