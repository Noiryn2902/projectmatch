import Link from 'next/link';

import { getInvitationByToken } from '@/lib/data/invitations';
import { hasDatabase } from '@/lib/env';

import { respondAction } from './actions';

/**
 * The page an invitation link lands on.
 *
 * This is the one route in the product that must work for someone with no
 * account, no session, and no membership of anything — so it reads through
 * the admin client with the token as its only credential, and asks for
 * nothing before letting the person answer. Requiring a sign-up before
 * someone can decline would be its own kind of rude.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ outcome?: string }>;
}) {
  const { token } = await params;
  const { outcome } = await searchParams;

  if (!hasDatabase) return <Shell title="Invitations are not available here." />;

  // An answer just recorded — show the result rather than the buttons again.
  if (outcome) return <Outcome outcome={outcome} />;

  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <Shell title="This invitation link is not valid.">
        <p className="mt-2 text-sm text-muted">
          It may have been mistyped, or withdrawn by whoever sent it.
        </p>
      </Shell>
    );
  }

  if (invitation.status !== 'pending') {
    return <Outcome outcome={'already_' + invitation.status} name={invitation.personName} />;
  }

  const expired = new Date(invitation.expiresAt) < new Date();
  if (expired) return <Outcome outcome="expired" name={invitation.personName} />;

  return (
    <Shell title={`${invitation.personName}, you have been asked to join a project.`}>
      <p className="mt-1 text-sm text-muted">
        {invitation.orgName} would like you to take the {invitation.roleTitle} seat.
      </p>

      <blockquote className="mt-5 rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5 text-[13px] text-ink">
        {invitation.projectBrief}
      </blockquote>

      {invitation.message && (
        <p className="mt-3 text-[13px] text-muted italic">&ldquo;{invitation.message}&rdquo;</p>
      )}

      <div className="mt-6 flex gap-2.5">
        <form action={respondAction} className="flex-1">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="accept" value="yes" />
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
          >
            Accept
          </button>
        </form>
        <form action={respondAction} className="flex-1">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="accept" value="no" />
          <button
            type="submit"
            className="w-full rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            Decline
          </button>
        </form>
      </div>

      <p className="mt-4 text-[11px] text-faint">
        Declining is a real answer, not a failure — the seat reopens and the team is worked out
        again without you.
      </p>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="text-[11px] tracking-wide text-faint uppercase">ProjectMatch</p>
      <h1 className="mt-1 font-display text-xl font-semibold text-balance text-ink">{title}</h1>
      {children}
    </main>
  );
}

function Outcome({ outcome, name }: { outcome: string; name?: string }) {
  const who = name ? name + ', t' : 'T';

  const copy: Record<string, { title: string; body: string }> = {
    accepted: {
      title: 'You are on the team.',
      body: 'The seat is yours. Whoever invited you can see that you accepted.',
    },
    declined: {
      title: 'Thanks for answering.',
      body: 'The seat has reopened, and the team will be worked out again without you.',
    },
    expired: {
      title: who + 'his invitation has expired.',
      body: 'The seat has reopened. Ask whoever invited you to send a new link.',
    },
    seat_taken: {
      title: 'That seat has already been filled.',
      body: 'Someone else took it while this invitation was unanswered.',
    },
    not_found: {
      title: 'This invitation link is not valid.',
      body: 'It may have been mistyped, or withdrawn by whoever sent it.',
    },
    already_accepted: { title: 'You already accepted this one.', body: 'Nothing more to do.' },
    already_declined: { title: 'You already declined this one.', body: 'The seat has reopened.' },
    already_expired: {
      title: 'This invitation has expired.',
      body: 'Ask whoever invited you to send a new link.',
    },
    already_revoked: {
      title: 'This invitation was withdrawn.',
      body: 'Whoever sent it has taken it back, or the seat was filled another way.',
    },
  };

  const { title, body } = copy[outcome] ?? {
    title: 'Something unexpected happened.',
    body: 'Ask whoever invited you to send a new link.',
  };

  return (
    <Shell title={title}>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link href="/" className="mt-6 text-[13px] text-accent underline underline-offset-2">
        Look around ProjectMatch
      </Link>
    </Shell>
  );
}
