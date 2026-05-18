import axios from "axios";
import dbConnect from "@/lib/mongodb";
import redis from "@/lib/redis";
import CFUser from "@/models/CFUser";
import DailyChallenge from "@/models/POTDDailyChallenge";
import POTDSubmission from "@/models/POTDSubmission";
import { logger } from "@/lib/utils";
import { computePoints } from "@/lib/potd-utils";

const CF_SUBMISSIONS_COUNT = 100;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes between health-check retries
const MAX_RETRIES = 6;
// Codeforces allows about 1 request/s. Using 2.1s protects the server from bans.
const INTER_USER_DELAY_MS = 2_100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Phase 1: Health check
 * Verify CF API is reachable. Retries up to MAX_RETRIES times,
 * waiting RETRY_DELAY_MS between attempts.
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
 * Phase 2: Sync pending submissions
 * For all POTDSubmissions with status=Pending for the challenge that just ended
 * (graceEnd <= now), fetch CF status and update each user atomically.
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
  }).populate("userId", "codeforcesId");

  logger.info(
    `[potd-sync] Syncing ${pendingSubs.length} pending submissions for challenge ${challenge._id} (${challenge.difficulty})`,
  );

  for (const sub of pendingSubs) {
    const user = sub.userId as any;
    if (!user || !user.codeforcesId) {
      if (now > graceEnd) {
        await POTDSubmission.findByIdAndUpdate(sub._id, {
          $set: { status: "NotSolved", lastCheckedAt: now },
        });
      }
      continue;
    }

    const cfUser = await CFUser.findOne({ userId: user._id });
    if (!cfUser?.cfVerified) {
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
        newStatus = solvedAt <= windowEnd ? "Accepted" : "Late";
      } else if (now > graceEnd) {
        newStatus = "NotSolved";
      }

      if ((newStatus === "Accepted" || newStatus === "Late") && solvedAt) {
        const currentStreak = cfUser.potdCurrentStreak ?? 0;
        pointsAwarded = computePoints(
          problem.rating,
          solvedAt.getTime(),
          windowEnd.getTime(),
          graceEnd.getTime(),
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
            solvedInGrace: newStatus === "Late",
            lastCheckedAt: now,
          },
        },
        { new: false },
      );

      const wasAlreadyFinal =
        prevSub?.status === "Accepted" || prevSub?.status === "Late";

      if (!wasAlreadyFinal) {
        if (newStatus === "Accepted") {
          // Normal solve
          const prevStreak = cfUser.potdCurrentStreak ?? 0;
          const newStreak = prevStreak + 1;
          await CFUser.findOneAndUpdate(
            { userId: user._id },
            {
              $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 },
              $max: { potdLongestStreak: newStreak },
              $set: { potdCurrentStreak: newStreak },
            },
          );
        } else if (newStatus === "Late") {
          // Grace solve
          await CFUser.findOneAndUpdate(
            { userId: user._id },
            {
              $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 },
            },
          );
        }
      }
    } catch (err) {
      logger.warn(`[potd-sync] Error syncing ${user.codeforcesId}`, { err });
    }

    await sleep(INTER_USER_DELAY_MS);
  }
}

/**
 * Phase 3: Streak reset
 * Reset streaks only for users who solved nothing today — neither in main or grace window.
 */
async function resetStreaksForDay(challenges: any[]): Promise<void> {
  if (challenges.length === 0) return;

  const challengeIds = challenges.map((c: any) => c._id);

  // Find User IDs that solved at least one challenge today
  const savedUserIds = await POTDSubmission.find({
    challengeId: { $in: challengeIds },
    status: { $in: ["Accepted", "Late"] },
  }).distinct("userId");

  // Reset streak for everyone who had no solve at all today
  const result = await CFUser.updateMany(
    {
      userId: { $nin: savedUserIds },
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

  const apiReachable = await waitForCFApi();
  if (!apiReachable) {
    logger.error("[potd-sync] CF API unreachable after all retries. Aborting.");
    return;
  }

  const now = new Date();

  // Find challenges whose grace period has ended (graceEnd <= now)
  const challenges = await DailyChallenge.find({
    graceEnd: { $lte: now },
  }).populate("problem");

  if (challenges.length === 0) {
    logger.info("[potd-sync] No challenges to sync.");
    return;
  }

  for (const challenge of challenges) {
    const cronKey = `potd:cron:lock:${challenge._id}`;
    const locked = await redis.set(cronKey, "1", { NX: true, EX: 600 });
    if (!locked) {
      logger.info(
        `[potd-sync] Skipping challenge ${challenge._id} — cron lock already held`,
      );
      continue;
    }

    try {
      await syncPendingSubmissions(challenge);
    } finally {
      await redis.del(cronKey);
    }
  }

  await resetStreaksForDay(challenges);

  logger.info("[potd-sync] POTD sync complete.");
}
