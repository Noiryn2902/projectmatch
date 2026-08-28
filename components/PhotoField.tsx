'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A photo field that shows you the photo.
 *
 * Every other input on the form echoes what you put in it; a file input tells
 * you a filename and nothing else, so you cannot tell a good crop from a
 * sideways one until it is already on your profile. This renders the picked
 * file immediately, from an object URL — no upload, no round trip, nothing
 * leaves the browser until the form is submitted.
 *
 * The cross means two different things depending on what is showing, and
 * both are what someone would expect:
 *
 *   - a file you just picked   → forget it, go back to what was there before
 *   - the photo already saved  → remove it, which the form does on submit
 *
 * The second sets a hidden flag rather than firing a request, so nothing is
 * destroyed by a click you can still change your mind about — closing the
 * page without submitting leaves the photo exactly where it was.
 */
export default function PhotoField({
  name = 'photo',
  accept,
  /** The photo already on the row, if any. */
  current,
  /** Initials to show when there is no image at all. */
  initials,
  hue = 0,
}: {
  name?: string;
  accept: string;
  current?: string | null;
  initials: string;
  hue?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  /*
   * An object URL is held by the browser until it is revoked, so every
   * re-pick would leak the previous one for the life of the page. Revoking
   * from the effect's cleanup rather than from the handlers means it happens
   * exactly once per URL — on replacement and on unmount — and never inside a
   * state updater, which React is free to run twice.
   */
  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked);
  }, [picked]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPicked(file ? URL.createObjectURL(file) : null);
    // Choosing a new photo is not also a request to delete the old one.
    if (file) setRemoved(false);
  }

  function clear() {
    if (picked) {
      // Undo the pick, keeping whatever was saved before it.
      setPicked(null);
      if (input.current) input.current.value = '';
      return;
    }
    setRemoved(true);
  }

  const src = picked ?? (removed ? null : (current ?? null));

  return (
    <div>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="relative shrink-0">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-full object-cover"
            />
          ) : initials ? (
            <span
              aria-hidden
              className="grid size-14 place-items-center rounded-full text-[19px] font-semibold"
              style={{
                background: `oklch(0.42 0.07 ${hue})`,
                color: `oklch(0.93 0.05 ${hue})`,
              }}
            >
              {initials}
            </span>
          ) : (
            <span
              aria-hidden
              className="block size-14 rounded-full border border-dashed border-line-strong"
            />
          )}

          {src && (
            <button
              type="button"
              onClick={clear}
              aria-label={picked ? 'Discard this photo' : 'Remove your photo'}
              title={picked ? 'Discard this photo' : 'Remove your photo'}
              className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full border border-line bg-panel text-[11px] leading-none text-muted transition-colors hover:border-warn hover:text-warn"
            >
              ×
            </button>
          )}
        </div>

        <div className="min-w-[150px] flex-1">
          <input
            ref={input}
            id={name}
            name={name}
            type="file"
            accept={accept}
            onChange={onPick}
            className="w-full text-[11px] text-muted file:mr-2 file:mb-1 file:rounded-full file:border-0 file:bg-panel-2 file:px-2.5 file:py-1 file:text-[11px] file:text-ink hover:file:bg-line"
          />
          {removed && !picked && (
            <p className="mt-1 text-[11px] text-warn">Removed when you continue.</p>
          )}
        </div>
      </div>

      {/* Read by the server action, so the removal happens on submit rather
          than on click. */}
      {removed && !picked && <input type="hidden" name="removePhoto" value="1" />}
    </div>
  );
}
