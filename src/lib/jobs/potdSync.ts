import axios from "axios";
import dbConnect from "@/lib/mongodb";
import redis from "@/lib/redis";
import User from "@/models/User";
import DailyChallenge from "@/models/POTDDailyChallenge";
import POTDSubmission from "@/models/POTDSubmission";
import { logger } from "@/lib/utils";
import { computePoints } from "@/lib/potd-utils";

// 50 per user is plenty since we do this daily, but Codeforces API permits up to 10M, we keep it small
const CF_SUBMISSIONS_COUNT = 100;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes between health-check retries
const MAX_RETRIES = 6;
// Codeforces allows about 1 request/s. Using 2.1s protects the server from bans.
const INTER_USER_DELAY_MS = 2_100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Phase 1: Health check — verify CF API is reachable.
 * Retries up to MAX_RETRIES times, waiting RETRY_DELAY_MS between attempts.
 */
async function waitForCFApi(): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(
        "https://codeforces.com/api/user.info?handles=tourist",
        { timeout: 8_000 },
      );
      if (data.status === "OK") return true;
    } catch {
      logger.warn(
        `[potd-sync] CF API unreachable (attempt ${attempt}/${MAX_RETRIES})`,
      );
    }
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
  }
  return false;
}

/**
 * Phase 2: For all POTDSubmissions with status=Pending for the challenge that
 * just ended (graceEnd <= now), fetch CF status and update each user atomically.
 * Skips any submission already marked Accepted.
 */
async function syncPendingSubmissions(challenge: any): Promise<void> {
  const problem = challenge.problem as any;
  const windowStart = challenge.windowStart as Date;
  const windowEnd = challenge.windowEnd as Date;
  const graceEnd = challenge.graceEnd as Date;
  const now = new Date();

  const pendingSubs = await POTDSubmission.find({
    challengeId: challenge._id,
    status: { $in: ["Pending"] },
  }).populate("userId", "codeforcesId cfVerified potdCurrentStreak");

  logger.info(
    `[potd-sync] Syncing ${pendingSubs.length} pending submissions for challenge ${challenge._id} (${challenge.difficulty})`,
  );

  for (const sub of pendingSubs) {
    const user = sub.userId as any;
    if (!user || !user.cfVerified || !user.codeforcesId) {
      // Can't sync without verified handle — mark NotSolved if grace has passed
      if (now > graceEnd) {
        await POTDSubmission.findByIdAndUpdate(sub._id, {
          $set: { status: "NotSolved", lastCheckedAt: now },
        });
      }
      continue;
    }

    try {
      const cfUrl = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(user.codeforcesId)}&from=1&count=${CF_SUBMISSIONS_COUNT}`;
      const { data } = await axios.get(cfUrl, { timeout: 10_000 });

      if (data.status !== "OK") {
        logger.warn(`[potd-sync] CF API bad status for ${user.codeforcesId}`);
        continue;
      }

      const cfSubs: any[] = data.result;
      const acceptedSub = cfSubs.find(
        (s: any) =>
          s.verdict === "OK" &&
          s.problem.contestId === problem.cfContestId &&
          s.problem.index === problem.cfIndex &&
          new Date(s.creationTimeSeconds * 1000) >= windowStart,
      );

      let newStatus: "Pending" | "Accepted" | "Late" | "NotSolved" = "Pending";
      let solvedAt: Date | null = null;
      let pointsAwarded = 0;

      if (acceptedSub) {
        solvedAt = new Date(acceptedSub.creationTimeSeconds * 1000);
        newStatus = solvedAt <= graceEnd ? "Accepted" : "Late";
      } else if (now > graceEnd) {
        newStatus = "NotSolved";
      }

      if (newStatus === "Accepted" && solvedAt && solvedAt <= windowEnd) {
        const currentStreak = user.potdCurrentStreak ?? 0;
        pointsAwarded = computePoints(
          problem.rating,
          solvedAt.getTime(),
          windowStart.getTime(),
          windowEnd.getTime(),
          currentStreak,
        );
      }

      const prevSub = await POTDSubmission.findByIdAndUpdate(
        sub._id,
        {
          $set: {
            status: newStatus,
            solvedAt,
            pointsAwarded,
            solvedInGrace:
              newStatus === "Accepted" &&
              solvedAt !== null &&
              solvedAt > windowEnd,
            lastCheckedAt: now,
          },
        },
        { new: false },
      );

      if (newStatus === "Accepted" && prevSub?.status !== "Accepted") {
        const prevStreak = user.potdCurrentStreak ?? 0;
        const newStreak = prevStreak + 1;
        await User.findByIdAndUpdate(user._id, {
          $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 },
          $max: { potdLongestStreak: newStreak },
          $set: { potdCurrentStreak: newStreak },
        });
      } else if (newStatus === "NotSolved") {
        // Streak reset only happens for active POTD participants (streak > 0)
        // who did not solve today's challenge. We handle this in Phase 3 below.
      }
    } catch (err) {
      logger.warn(`[potd-sync] Error syncing ${user.codeforcesId}`, { err });
    }

    await sleep(INTER_USER_DELAY_MS);
  }
}

/**
 * Phase 3: Streak reset — for users who did NOT solve ANY challenge today,
 * reset their current streak. A user maintains their streak if they solved
 * at least one challenge from today's set.
 */
async function resetStreaksForDay(challenges: any[]): Promise<void> {
  if (challenges.length === 0) return;

  // Collect all challenge IDs for the day
  const challengeIds = challenges.map((c: any) => c._id);

  // Find users who solved at least one challenge today
  const solvedUserIds = await POTDSubmission.find({
    challengeId: { $in: challengeIds },
    status: "Accepted",
  }).distinct("userId");

  // Reset streak for all other users who had a streak > 0
  const result = await User.updateMany(
    {
      _id: { $nin: solvedUserIds },
      potdCurrentStreak: { $gt: 0 },
    },
    { $set: { potdCurrentStreak: 0 } },
  );

  if (result.modifiedCount > 0) {
    logger.info(
      `[potd-sync] Reset streaks for ${result.modifiedCount} users who missed today's challenges`,
    );
  }
}

/**
 * Main cron handler
 */
export async function syncPOTDSubmissions(): Promise<void> {
  logger.info("[potd-sync] Starting POTD submission sync...");

  await dbConnect();

  // Find the challenge whose grace window just closed (graceEnd <= now + 2min)
  const now = new Date();
  const buffer = new Date(now.getTime() + 2 * 60 * 1000); // 2-minute buffer
  const lookback = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

  // Find ALL challenges whose grace window just closed
  const challenges = await DailyChallenge.find({
    graceEnd: { $gte: lookback, $lte: buffer },
  }).populate("problem");

  if (challenges.length === 0) {
    logger.info(
      "[potd-sync] No challenges found in grace-end window, skipping",
    );
    return;
  }

  logger.info(`[potd-sync] Found ${challenges.length} challenge(s) to sync`);

  // Use the first challenge's ID as the cron lock key (they all share graceEnd)
  const cronLockKey = `potd:cron:lock:day:${challenges[0].windowStart.toISOString().slice(0, 10)}`;
  const locked = await redis.set(cronLockKey, "1", { NX: true, EX: 20 * 60 });
  if (!locked) {
    logger.warn("[potd-sync] Cron already running for today, skipping");
    return;
  }

  // Also set per-challenge lock keys so manual syncs back off
  for (const c of challenges) {
    await redis.set(`potd:cron:lock:${c._id}`, "1", { EX: 20 * 60 });
  }

  try {
    // Phase 1: Health check
    const cfReachable = await waitForCFApi();
    if (!cfReachable) {
      logger.error(
        "[potd-sync] CF API unreachable after all retries, aborting",
      );
      return;
    }

    // Phase 2: Sync pending submissions for each challenge
    for (const challenge of challenges) {
      await syncPendingSubmissions(challenge);
    }

    // Phase 3: Streak reset — user saved if they solved ANY challenge today
    await resetStreaksForDay(challenges);

    logger.info("[potd-sync] POTD sync completed successfully");
  } finally {
    await redis.del(cronLockKey);
    for (const c of challenges) {
      await redis.del(`potd:cron:lock:${c._id}`);
    }
  }
}
