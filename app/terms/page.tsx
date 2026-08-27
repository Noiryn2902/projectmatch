import Link from 'next/link';

export const metadata = {
  title: 'Terms — ProjectMatch',
  description: 'The terms you agree to by using ProjectMatch.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-16">
      <Link href="/" className="text-[13px] text-muted hover:text-ink">
        &larr; ProjectMatch
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold text-ink">Terms of service</h1>
      <p className="mt-2 text-[13px] text-faint">Last updated 28 August 2026.</p>

      <div className="mt-8 space-y-8 text-[14px] leading-relaxed text-muted">
        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Using ProjectMatch</h2>
          <p className="mt-2">
            ProjectMatch helps organisations form project teams from their own people. By using it
            you agree to these terms. If you are setting it up for an organisation, you confirm you
            are allowed to do so on its behalf.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Your account</h2>
          <p className="mt-2">
            Sign in with an address you control. Keep access to it — anyone who can read your email
            can sign in as you. Tell us if you think someone else has got in.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">
            What you put in
          </h2>
          <p className="mt-2">
            You keep ownership of what you upload — your profile, your résumé, your messages. You
            give us permission to store and process it in order to run the service, and nothing
            further.
          </p>
          <p className="mt-2">
            Only upload things you have the right to upload. If you add someone else to a roster,
            you are confirming your organisation has a proper basis for holding their details.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Fair use</h2>
          <p className="mt-2">Do not use ProjectMatch to:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>break the law, or anyone&rsquo;s rights</li>
            <li>upload data you were not entitled to hold</li>
            <li>attack, overload, or try to get around the security of the service</li>
            <li>impersonate someone, or claim skills or credentials that are not yours</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">
            What the rankings are, and are not
          </h2>
          <p className="mt-2">
            ProjectMatch produces suggestions. It scores what a person adds to a team being built,
            using the skill levels and availability it has been given, and it tells you what it
            could not cover.
          </p>
          <p className="mt-2">
            It is a decision aid, not a decision. Staffing, hiring, and every other employment
            judgement remains yours, and you are responsible for making those fairly and lawfully.
            A ranking is only ever as good as the data behind it — which is why the product shows
            you where each skill level came from rather than presenting a confident number and
            stopping.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Availability</h2>
          <p className="mt-2">
            The service is provided as is. We do not promise it will be uninterrupted or
            error-free, and we may change or discontinue features. Where the law allows, we are not
            liable for indirect or consequential loss arising from your use of it.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Ending it</h2>
          <p className="mt-2">
            You can stop using ProjectMatch whenever you like and ask for your account to be
            deleted — see{' '}
            <Link href="/privacy" className="text-accent underline underline-offset-2">
              Privacy
            </Link>
            . We may suspend an account that breaks these terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Contact</h2>
          <p className="mt-2">
            <a
              href="mailto:tarunsha2902@gmail.com"
              className="text-accent underline underline-offset-2"
            >
              tarunsha2902@gmail.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
