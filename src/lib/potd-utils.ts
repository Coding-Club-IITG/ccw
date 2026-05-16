/**
 * Pure utility helpers for POTD window calculations and scoring.
 * NOT a server action file — no "use server" directive.
 * Safe to import from both server actions and background jobs.
 */

/**
 * Given YYYY-MM-DD string (IST date), compute the three window timestamps.
 * Window: 5:00 PM IST (11:30 UTC) on `dateStr` → 5:59 PM IST next day (12:29 UTC)
 */
export function computeWindowTimes(dateStr: string): {
  windowStart: Date;
  windowEnd: Date;
  graceEnd: Date;
} {
  const [year, month, day] = dateStr.split("-").map(Number);
  // windowStart: challenge date at 11:30:00 UTC (= 5:00 PM IST)
  const windowStart = new Date(Date.UTC(year, month - 1, day, 11, 30, 0, 0));
  // windowEnd: next day at 11:29:59 UTC (= 4:59:59 PM IST)
  const windowEnd = new Date(
    Date.UTC(year, month - 1, day + 1, 11, 29, 59, 999),
  );
  // graceEnd: next day at 12:29:59 UTC (= 5:59:59 PM IST)
  const graceEnd = new Date(
    Date.UTC(year, month - 1, day + 1, 12, 29, 59, 999),
  );
  return { windowStart, windowEnd, graceEnd };
}

/**
 * Returns the current IST date string (YYYY-MM-DD).
 * Before 5:00 PM IST → yesterday's challenge; at/after 5:00 PM IST → today's.
 */
export function getTodayISTDateStr(): string {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

/**
 * PRD scoring formula:
 *   Points = round((rating / 10) × (1 - 0.5 × hoursElapsed/24) × (1 + 0.05 × min(streak, 10)))
 * hoursElapsed = (solvedAt - windowStart) / 3_600_000
 * Grace window solves (solvedAt > windowEnd) → 0 points.
 */
export function computePoints(
  rating: number,
  solvedAtMs: number,
  windowStartMs: number,
  windowEndMs: number,
  currentStreak: number,
): number {
  if (solvedAtMs > windowEndMs) return 0;
  const hoursElapsed = (solvedAtMs - windowStartMs) / 3_600_000;
  const base = rating / 10;
  const timeFactor = 1.0 - 0.5 * Math.max(0, hoursElapsed / 24);
  const streakBonus = 1.0 + 0.05 * Math.min(currentStreak, 10);
  return Math.max(0, Math.round(base * timeFactor * streakBonus));
}
