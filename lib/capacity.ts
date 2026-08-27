/**
 * Whether a person has room for one more seat. Pure — no IO, no server-only
 * import — so the rule lives in one place and is checkable on its own.
 */

export type CapacityVerdict = 'clear' | 'tight' | 'over';

/**
 * Where seating one more role of `adding` hours leaves a person, given what
 * they are already committed to and their weekly ceiling.
 *
 * A ceiling of 0 means none was recorded, so there is nothing to judge
 * against and the answer is always `clear`.
 */
export function capacityVerdict(
  committed: number,
  adding: number,
  capacity: number,
): CapacityVerdict {
  if (capacity <= 0) return 'clear';
  const after = committed + adding;
  if (after > capacity) return 'over';
  if (after > capacity * 0.9) return 'tight';
  return 'clear';
}
