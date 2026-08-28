import { NextResponse, type NextRequest } from 'next/server';

import { getProject } from '@/lib/data/projects';
import { hasDatabase } from '@/lib/env';
import { agendaFor, overlapWindow, proposeSlots, toIcs } from '@/lib/meeting';

/**
 * The kickoff as a calendar file.
 *
 * A Route Handler rather than a Blob built in the browser, which is what the
 * original build did. Three reasons, in order of how much they matter:
 *
 *   - it works with JavaScript off, and is a plain link rather than a click
 *     handler pretending to be one;
 *   - the file is generated from the project as the server sees it, so it
 *     cannot describe a team the caller is not allowed to read — getProject
 *     runs under the caller's own session and RLS decides;
 *   - the URL is shareable and re-fetchable, where a blob: URL dies with the
 *     tab that made it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasDatabase) return new NextResponse('Not configured', { status: 404 });

  const { id } = await params;
  const project = await getProject(id);
  // RLS already refused if this project is not theirs; a null here means it
  // does not exist or is not visible, and those deserve the same answer.
  if (!project) return new NextResponse('Not found', { status: 404 });

  const members = project.members;
  const slots = proposeSlots(overlapWindow(members));

  const raw = Number(request.nextUrl.searchParams.get('slot') ?? 0);
  const slot = Number.isFinite(raw) ? Math.min(slots.length - 1, Math.max(0, Math.trunc(raw))) : 0;
  const start = slots[slot];

  if (!start) {
    return new NextResponse('This team has no shared working window.', { status: 409 });
  }

  const ics = toIcs({
    title: `${project.name || project.brief.text.slice(0, 40)} — kickoff`,
    start,
    agenda: agendaFor(project.brief, members, project.health),
    attendees: members.map((p) => p.contact.email).filter(Boolean),
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="kickoff.ics"',
      // The proposed days move with the calendar, so this must not be cached.
      'Cache-Control': 'no-store',
    },
  });
}
