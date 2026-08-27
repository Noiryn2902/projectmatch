import Link from 'next/link';

export const metadata = {
  title: 'Privacy — ProjectMatch',
  description: 'What ProjectMatch stores, why, who can see it, and how to have it deleted.',
};

/**
 * A privacy policy that describes what this application actually does.
 *
 * Written against the real code rather than adapted from a template: every
 * claim here is checkable against lib/data, lib/skills and the RLS policies
 * in supabase/migrations. That matters more than usual for this product,
 * because it holds employment-adjacent data about people who did not choose
 * the tool themselves.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-16">
      <Link href="/" className="text-[13px] text-muted hover:text-ink">
        &larr; ProjectMatch
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold text-ink">Privacy</h1>
      <p className="mt-2 text-[13px] text-faint">Last updated 28 August 2026.</p>

      <div className="mt-8 space-y-8 text-[14px] leading-relaxed text-muted">
        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">What this is</h2>
          <p className="mt-2">
            ProjectMatch helps an organisation put project teams together from its own people. It is
            used inside an organisation — you are here because your employer or a colleague set it
            up, or because you were invited to a project.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">What we store</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <span className="text-ink">Your account.</span> Email address, and the display name
              your sign-in provider gives us. We never see or store a password — sign-in is by
              Google, GitHub, or a link emailed to you.
            </li>
            <li>
              <span className="text-ink">Your profile.</span> Name, job title, location, hours a
              week, qualification, and a photo if you upload one.
            </li>
            <li>
              <span className="text-ink">Your skills</span> and where each one came from — typed in,
              read from a résumé you supplied, read from a public GitHub profile, endorsed by a
              colleague, or verified by your organisation.
            </li>
            <li>
              <span className="text-ink">Your work.</span> Projects you are on, invitations sent to
              you and your answers, and messages you post in a project conversation.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">
            What we do not do
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>We do not scrape LinkedIn or anywhere else. Everything comes from you, from your
              organisation, or from a public GitHub profile you name yourself.</li>
            <li>We do not sell or share your data with advertisers, and there is no advertising.</li>
            <li>We do not track you across other websites.</li>
            <li>We do not read your Google account beyond your email address and name.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Who can see it</h2>
          <p className="mt-2">
            Members of your organisation. Not the public, and not other organisations — that
            boundary is enforced by the database itself on every single query, not by application
            code remembering to check.
          </p>
          <p className="mt-2">
            One exception, and it is deliberate: an invitation link works for someone with no
            account, because requiring a stranger to sign up before they can decline would be its
            own kind of rude. The link shows the project brief, the role, and who is asking.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">
            Where it goes, and who else touches it
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <span className="text-ink">Supabase</span> hosts the database and handles sign-in.
              Data is stored in their South Asia (Mumbai) region.
            </li>
            <li>
              <span className="text-ink">Vercel</span> hosts the application.
            </li>
            <li>
              <span className="text-ink">Google Gemini</span> sees résumé text, and only at the
              moment you ask us to read one. It is used to identify which of our 82 known skills the
              text evidences. We do not store the résumé itself — the text is read, the skills are
              kept, the text is discarded.
            </li>
            <li>
              <span className="text-ink">GitHub&rsquo;s public API</span> is called only when you
              give us a username, and only for public repositories.
            </li>
            <li>
              <span className="text-ink">Resend</span> delivers invitation emails, when email is
              configured.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Your choices</h2>
          <p className="mt-2">
            You can edit or clear your profile details and skills at any time from your profile
            page. To have your account and everything attached to it deleted, email the address
            below and we will remove it.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[17px] font-semibold text-ink">Demo data</h2>
          <p className="mt-2">
            The demonstration organisation you can browse without signing in contains sixty
            entirely fictional people, generated for the purpose. They are not real, and no real
            person&rsquo;s data was used to create them.
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
