/** Formats a millisecond duration as "m:ss". */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * time-to-target is 0 until both sides first reach target for the current
 * cooling session, then holds that elapsed time - not a live countdown.
 */
export function formatTimeToTarget(ms) {
  if (ms == null) return 'N/A';
  if (ms === 0) return 'Not reached yet';
  return formatClock(ms);
}
