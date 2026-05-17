/**
 * Pure utility helpers for POTD window calculations, scoring, and date formatting
 */

import { IST_OFFSET_MS } from "./constants";

/**
 * Given IST date string, compute the three window timestamps
 * Window: 12:00 AM IST (18:30 UTC prev day) -> 11:59 PM IST (18:29 UTC same day)
 * Grace:  11:59 PM IST -> 1:00 AM IST next day (19:29:59 UTC same day)
 */
export function computeWindowTimes(dateStr: string): {
  windowStart: Date;
  windowEnd: Date;
  graceEnd: Date;
} {
  const [year, month, day] = dateStr.split("-").map(Number);
  // windowStart: 12:00 AM IST = 18:30:00 UTC on the *previous* calendar day
  const windowStart = new Date(
    Date.UTC(year, month - 1, day - 1, 18, 30, 0, 0),
  );
  // windowEnd: 11:59:59 PM IST = 18:29:59 UTC on the challenge date
  const windowEnd = new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
  // graceEnd: 1:00 AM IST next day = 19:29:59 UTC on the challenge date (1h grace)
  const graceEnd = new Date(Date.UTC(year, month - 1, day, 19, 29, 59, 999));
  return { windowStart, windowEnd, graceEnd };
}

/**
 * Returns the current IST date string
 * The challenge for a given IST date runs from midnight to midnight IST,
 * so the current date is simply the IST wall-clock date.
 */
export function getTodayISTDateStr(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Converts a `windowStart` timestamp to the corresponding IST date string
 * windowStart is 18:30 UTC on (challenge date - 1), which equals
 * 00:00 IST on the challenge date. Adding IST_OFFSET_MS shifts it
 * to 00:00 UTC representation of the challenge date, so slicing the
 * ISO string gives the correct IST date directly.
 */
export function windowStartToISTDateStr(windowStart: Date | string): string {
  const ms = new Date(windowStart).getTime() + IST_OFFSET_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Returns today + the next 10 days as IST date strings,
 * giving the full scheduling horizon for upcoming POTD problems
 */
export function getAvailableDates(): string[] {
  const dates: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const istDate = new Date(Date.now() + IST_OFFSET_MS);
    istDate.setUTCDate(istDate.getUTCDate() + i);
    dates.push(istDate.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Formats a YYYY-MM-DD date string into a
 * human-readable label for display in POTD UI components
 */
export function formatDate(
  dateStr: string,
  weekday?: "short" | "long",
): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: weekday ?? undefined,
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * PRD scoring formula:
 *   Points = round((rating / 10) × (1 - 0.5 × hoursElapsed/24) × (1 + 0.05 × min(streak, 10)))
 * hoursElapsed = (solvedAt - windowStart) / 3_600_000
 * Grace window solves (solvedAt > windowEnd) -> 0 points
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
