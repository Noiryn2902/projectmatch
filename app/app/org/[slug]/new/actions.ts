'use server';

import { redirect } from 'next/navigation';

import { createProject } from '@/lib/data/projects';
import { fallbackBrief } from '@/lib/ai/fallback';
import type { Brief } from '@/lib/types';

export async function createProjectAction(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const text = String(formData.get('text') ?? '').trim();
  if (!orgId || text.length < 8) return;

  const brief: Brief = { text, ...fallbackBrief(text) };
  const id = await createProject(orgId, brief);

  redirect('/project/' + id);
}
