'use client';

import Reveal from './Reveal';

export default function BigCta() {
  return (
    <section className="mx-auto max-w-[1180px] xl:max-w-[1400px] px-5 pb-20">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12"
          style={{
            background:
              'linear-gradient(120deg, #b8862c 0%, #e0a93f 32%, #6bbf8a 78%, #4e9c8f 100%)',
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, #000 1px, transparent 1px), radial-gradient(circle at 70% 70%, #000 1px, transparent 1px)',
              backgroundSize: '28px 28px, 34px 34px',
            }}
          />
          <div className="relative">
            <h2 className="font-display text-[24px] leading-tight font-bold tracking-tight text-[#1a1206] sm:text-[34px]">
              Describe the project. Get the team.
            </h2>
            <p className="mx-auto mt-3 max-w-[460px] text-[14px] leading-relaxed text-[#2a1d08]">
              Two lines is enough. No account, no database, nothing to install.
            </p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="mt-8 rounded-xl bg-[#120d05] px-7 py-3 text-[14px] font-medium text-[#f3ece0] transition-transform hover:scale-[1.02]"
            >
              Start with your brief
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
