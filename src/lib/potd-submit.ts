import POTDSubmission from "@/models/POTDSubmission";
import CFUser from "@/models/CFUser";
import DailyChallenge from "@/models/POTDDailyChallenge";
import { computePoints } from "./potd-utils";

/**
 * Process a user's submission for a specific challenge
 */
export async function processSubmission(
  userId: string,
  challenge: any,
  cfUser: any,
  cfSubs: any[],
  now: Date = new Date(),
): Promise<{ status: string; pointsAwarded: number }> {
  const problem = challenge.problem as any;
  const challengeId = challenge._id;
  const windowStart = challenge.windowStart as Date;
  const windowEnd = challenge.windowEnd as Date;
  const graceEnd = challenge.graceEnd as Date;

  // Find 1st AC for this problem submitted after windowStart
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

  // Handle outcome
  if ((newStatus === "Accepted" || newStatus === "Late") && solvedAt) {
    // Check if other challenges for the same windowStart were solved Accepted
    const todaysChallengeIds: any[] = await DailyChallenge.find({
      windowStart: challenge.windowStart,
    }).distinct("_id");

    const otherChallengeIds = todaysChallengeIds.filter(
      (id) => id.toString() !== challengeId.toString(),
    );

    const alreadySolvedToday =
      otherChallengeIds.length > 0 &&
      !!(await POTDSubmission.exists({
        userId,
        challengeId: { $in: otherChallengeIds },
        status: "Accepted",
      }));

    const currentStreak = cfUser.potdCurrentStreak ?? 0;
    // Points should always reflect streak at the start of the day
    const effectiveStreak = alreadySolvedToday
      ? Math.max(0, currentStreak - 1)
      : currentStreak;

    pointsAwarded = computePoints(
      problem.rating,
      solvedAt.getTime(),
      windowEnd.getTime(),
      graceEnd.getTime(),
      effectiveStreak,
    );
  }

  // Update POTDSubmission
  const prevSub = await POTDSubmission.findOneAndUpdate(
    { userId, challengeId },
    {
      $set: {
        status: newStatus,
        solvedAt,
        pointsAwarded,
        solvedInGrace: newStatus === "Late",
        lastCheckedAt: now,
      },
      $setOnInsert: { userId, challengeId },
    },
    { upsert: true, new: false },
  );

  const wasAlreadyFinal =
    prevSub?.status === "Accepted" || prevSub?.status === "Late";

  // If newly finalized, update CFUser stats
  if (!wasAlreadyFinal) {
    if (newStatus === "Accepted") {
      const todaysChallengeIds: any[] = await DailyChallenge.find({
        windowStart: challenge.windowStart,
      }).distinct("_id");

      const otherChallengeIds = todaysChallengeIds.filter(
        (id) => id.toString() !== challengeId.toString(),
      );

      const alreadySolvedToday =
        otherChallengeIds.length > 0 &&
        !!(await POTDSubmission.exists({
          userId,
          challengeId: { $in: otherChallengeIds },
          status: "Accepted",
        }));

      if (!alreadySolvedToday) {
        // Streak increments only on 1st solve of the day
        const prevStreak = cfUser.potdCurrentStreak ?? 0;
        const newStreak = prevStreak + 1;
        await CFUser.findOneAndUpdate(
          { userId },
          {
            $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 },
            $max: { potdLongestStreak: newStreak },
            $set: { potdCurrentStreak: newStreak },
          },
        );
      } else {
        await CFUser.findOneAndUpdate(
          { userId },
          { $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 } },
        );
      }
    } else if (newStatus === "Late") {
      await CFUser.findOneAndUpdate(
        { userId },
        { $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 } },
      );
    }
  }

  return { status: newStatus, pointsAwarded };
}
