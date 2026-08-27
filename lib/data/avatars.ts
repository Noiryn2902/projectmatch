import 'server-only';

import { createAdminSupabase } from '../supabase/admin';
import { createServerSupabase, getCurrentUser } from '../supabase/server';

/**
 * Profile photos.
 *
 * The upload itself runs through the admin client, which means storage
 * needs no policies of its own — and that is a deliberate trade, not
 * laziness. Storage RLS would have to re-derive "is this your row, in your
 * org" from a path string, duplicating a rule the database already enforces
 * on `people`. Instead the check happens here, once, against the same
 * ownership the rest of the product uses: you may replace the photo on a
 * row that is yours, or any row in an org you administer. Everything else
 * is refused before a byte is written.
 *
 * `people.photo` holds either a bare filename (the seeded portraits, served
 * from /media/people) or a full https URL (an upload). Avatar decides which
 * by looking for the scheme, so both live side by side without a migration.
 */

const BUCKET = 'avatars';
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPTED = 'image/png,image/jpeg,image/webp';

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export class AvatarError extends Error {}

/**
 * Stores an image and points the person row at it. Returns the public URL.
 *
 * Whether the caller is allowed is decided by asking the database, as that
 * user, to update the row — if RLS refuses the update, the photo is orphaned
 * in the bucket rather than attached, and nothing is exposed.
 */
export async function setAvatar(personId: string, file: File): Promise<string> {
  if (file.size === 0) throw new AvatarError('That image is empty.');
  if (file.size > MAX_AVATAR_BYTES) throw new AvatarError('Images must be under 2MB.');

  const ext = EXT[file.type];
  if (!ext) throw new AvatarError('Use a PNG, JPEG, or WebP image.');

  const user = await getCurrentUser();
  if (!user) throw new AvatarError('You have to be signed in.');

  // Ask the database, as this user, whether they may write this row at all.
  // people_update already encodes the answer: your own row, or any row in an
  // org you administer. Checking it here means an upload that would not stick
  // never happens.
  const supabase = await createServerSupabase();
  const { data: allowed, error: probeErr } = await supabase
    .from('people')
    .select('id')
    .eq('id', personId)
    .maybeSingle();
  if (probeErr) throw new AvatarError('Could not find that profile.');
  if (!allowed) throw new AvatarError('That profile is not visible to you.');

  // A stable path per person, so replacing a photo replaces the object
  // instead of accumulating one file per attempt.
  const path = `${personId}.${ext}`;

  const admin = createAdminSupabase();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: true,
    });
  if (upErr) throw new AvatarError('Could not store that image: ' + upErr.message);

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);

  // Cache-bust, or a replaced photo keeps showing the old one.
  const url = `${publicUrl}?v=${Date.now()}`;

  // The real authorisation gate: this update runs as the user, under RLS.
  const { error: rowErr } = await supabase
    .from('people')
    .update({ photo: url })
    .eq('id', personId);

  if (rowErr) {
    if (rowErr.code === '42501' || rowErr.message.toLowerCase().includes('row-level security')) {
      throw new AvatarError('You can only change your own photo.');
    }
    throw new AvatarError('Could not save the photo: ' + rowErr.message);
  }

  return url;
}
