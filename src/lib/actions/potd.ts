"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import axios from "axios";
import dbConnect from "@/lib/mongodb";
import redis from "@/lib/redis";
import User from "@/models/User";
import Problem from "@/models/POTDProblem";
import DailyChallenge from "@/models/POTDDailyChallenge";
import POTDSubmission from "@/models/POTDSubmission";

// Ensure models are registered (prevents Next.js compiler from tree-shaking unused model imports)
[User, Problem, DailyChallenge, POTDSubmission].forEach(
  (m) => m && m.init && m.init(),
);

import { logger } from "@/lib/utils";
import { DIFFICULTY_ORDER } from "@/lib/constants";
import {
  computeWindowTimes,
  getTodayISTDateStr,
  computePoints,
} from "@/lib/potd-utils";

// Public Types

export type ChallengeEntry = {
  challengeId: string;
  difficulty: "Easy" | "Medium" | "Hard";
  problem: {
    cfContestId: number;
    cfIndex: string;
    name: string;
    rating: number;
  };
  mySubmission: {
    status: "Pending" | "Accepted" | "Late" | "NotSolved" | "none";
    solvedAt: string | null;
    pointsAwarded: number;
  };
};

export type TodayChallengeData = {
  windowStart: string; // ISO — shared across all challenges for the day
  windowEnd: string; // ISO — EOD IST (18:29 UTC)
  graceEnd: string; // ISO — ~1 AM IST next day (19:29 UTC)
  challenges: ChallengeEntry[]; // sorted Easy -> Medium -> Hard
};

// Get Today's Challenges

export async function getTodayChallenge(): Promise<{
  ok: boolean;
  data?: TodayChallengeData;
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  await dbConnect();

  const now = new Date();
  const challenges = await DailyChallenge.find({
    windowStart: { $lte: now },
    windowEnd: { $gte: now },
  })
    .sort({ difficulty: 1 })
    .populate("problem");

  if (challenges.length === 0)
    return { ok: false, error: "No active challenge" };

  // All challenges for a day share the same window — use the first
  const first = challenges[0] as any;

  const entries: ChallengeEntry[] = await Promise.all(
    challenges.map(async (c: any) => {
      const problem = c.problem as any;
      const sub = await POTDSubmission.findOne({
        userId: session.user.id,
        challengeId: c._id,
      });
      return {
        challengeId: c._id.toString(),
        difficulty: c.difficulty,
        problem: {
          cfContestId: problem.cfContestId,
          cfIndex: problem.cfIndex,
          name: problem.name,
          rating: problem.rating,
        },
        mySubmission: sub
          ? {
              status: sub.status,
              solvedAt: sub.solvedAt ? sub.solvedAt.toISOString() : null,
              pointsAwarded: sub.pointsAwarded,
            }
          : { status: "none", solvedAt: null, pointsAwarded: 0 },
      };
    }),
  );

  // Sort Easy -> Medium -> Hard
  entries.sort(
    (a, b) =>
      (DIFFICULTY_ORDER[a.difficulty] ?? 99) -
      (DIFFICULTY_ORDER[b.difficulty] ?? 99),
  );

  return {
    ok: true,
    data: {
      windowStart: first.windowStart.toISOString(),
      windowEnd: first.windowEnd.toISOString(),
      graceEnd: first.graceEnd.toISOString(),
      challenges: entries,
    },
  };
}

// Sync My Submission

const CF_SUBMISSIONS_COUNT = 50;

/**
 * Manually sync the current user's CF submission against today's challenge.
 * Uses a 3-layer Redis lock pattern:
 *   L1: per-user global sync rate-limit (60s)
 *   L2: per-user per-challenge advisory lock (30s) — prevents double-click races
 *   L3: per-challenge cron lock guard — if cron is running, back off
 */
export async function syncMySubmission(challengeId: string): Promise<{
  ok: boolean;
  status?: string;
  pointsAwarded?: number;
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  const userId = session.user.id;
  const user = session.user as any;

  if (!user.cfVerified || !user.codeforcesId) {
    return { ok: false, error: "Codeforces handle not verified" };
  }

  // L1: rate-limit — one manual sync per 60s per user
  const rateLimitKey = `potd:sync:ratelimit:${userId}`;
  const rateLimitSet = await redis.set(rateLimitKey, "1", { NX: true, EX: 60 });
  if (!rateLimitSet) {
    const ttl = await redis.ttl(rateLimitKey);
    return { ok: false, error: `Please wait ${ttl}s before syncing again` };
  }

  // L2: advisory lock
  const advisoryKey = `potd:sync:lock:${userId}:${challengeId}`;
  const advisorySet = await redis.set(advisoryKey, "1", { NX: true, EX: 30 });
  if (!advisorySet) {
    await redis.del(rateLimitKey);
    return { ok: false, error: "Sync already in progress" };
  }

  // L2.5: global CF API rate limit
  const globalCFLimitKey = `potd:sync:cf_api_global`;
  const cfApiLocked = await redis.set(globalCFLimitKey, "1", {
    NX: true,
    EX: 2,
  });
  if (!cfApiLocked) {
    await redis.del(rateLimitKey);
    await redis.del(advisoryKey);
    return {
      ok: false,
      error: "Codeforces is busy. Please try again in 5 seconds.",
    };
  }

  // L3: check if cron is running
  const cronKey = `potd:cron:lock:${challengeId}`;
  const cronRunning = await redis.get(cronKey);
  if (cronRunning) {
    await redis.del(rateLimitKey);
    await redis.del(advisoryKey);
    return {
      ok: false,
      error: "Auto-sync is running. Your result will be updated shortly.",
    };
  }

  try {
    await dbConnect();

    const challenge =
      await DailyChallenge.findById(challengeId).populate("problem");
    if (!challenge) return { ok: false, error: "Challenge not found" };

    const problem = challenge.problem as any;
    const windowStart = challenge.windowStart as Date;
    const windowEnd = challenge.windowEnd as Date;
    const graceEnd = challenge.graceEnd as Date;
    const now = new Date();

    // Fetch CF submissions
    const cfUrl = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(user.codeforcesId)}&from=1&count=${CF_SUBMISSIONS_COUNT}`;
    const { data } = await axios.get(cfUrl, { timeout: 10_000 });

    if (data.status !== "OK") {
      return { ok: false, error: "Codeforces API returned an error" };
    }

    // Find first AC for this problem submitted after windowStart
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

    // Points only in main window (windowStart -> windowEnd)
    if (newStatus === "Accepted" && solvedAt && solvedAt <= windowEnd) {
      const dbUser = await User.findById(userId);
      const currentStreak = dbUser?.potdCurrentStreak ?? 0;
      pointsAwarded = computePoints(
        problem.rating,
        solvedAt.getTime(),
        windowStart.getTime(),
        windowEnd.getTime(),
        currentStreak,
      );
    }

    // Atomic upsert
    const prevSub = await POTDSubmission.findOneAndUpdate(
      { userId, challengeId },
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
        $setOnInsert: { userId, challengeId },
      },
      { upsert: true, new: false },
    );

    // Update user stats only if newly accepted
    const wasAlreadyAccepted = prevSub?.status === "Accepted";
    if (newStatus === "Accepted" && !wasAlreadyAccepted) {
      const dbUser = await User.findById(userId);
      const prevStreak = dbUser?.potdCurrentStreak ?? 0;
      const newStreak = prevStreak + 1;
      await User.findByIdAndUpdate(userId, {
        $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 },
        $max: { potdLongestStreak: newStreak },
        $set: { potdCurrentStreak: newStreak },
      });
    }

    revalidatePath("/internal/potd");

    return { ok: true, status: newStatus, pointsAwarded };
  } catch (err) {
    logger.error("[syncMySubmission] Error", { err });
    return { ok: false, error: "An unexpected error occurred" };
  } finally {
    await redis.del(advisoryKey);
    // rate-limit key stays until TTL expires naturally
  }
}

// Get Past Problems

export type PastProblemEntry = {
  challengeId: string;
  windowStart: string;
  difficulty: "Easy" | "Medium" | "Hard";
  problem: {
    cfContestId: number;
    cfIndex: string;
    name: string;
    rating: number;
  };
  solvedBy: number;
};

export async function getPastProblems(
  limit = 30,
): Promise<{ ok: boolean; data?: PastProblemEntry[]; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  await dbConnect();

  const now = new Date();
  const challenges = await DailyChallenge.find({ graceEnd: { $lt: now } })
    .sort({ windowStart: -1, difficulty: 1 })
    .limit(limit)
    .populate("problem");

  const challengeIds = challenges.map((c: any) => c._id);
  const counts = await POTDSubmission.aggregate([
    {
      $match: {
        challengeId: { $in: challengeIds },
        status: "Accepted",
      },
    },
    { $group: { _id: "$challengeId", count: { $sum: 1 } } },
  ]);

  const countMap = new Map<string, number>(
    counts.map((c: any) => [c._id.toString(), c.count]),
  );

  const data: PastProblemEntry[] = challenges.map((c: any) => {
    const p = c.problem as any;
    return {
      challengeId: c._id.toString(),
      windowStart: c.windowStart.toISOString(),
      difficulty: c.difficulty,
      problem: {
        cfContestId: p.cfContestId,
        cfIndex: p.cfIndex,
        name: p.name,
        rating: p.rating,
      },
      solvedBy: countMap.get(c._id.toString()) ?? 0,
    };
  });

  return { ok: true, data };
}

// Leaderboard

export type LeaderboardEntry = {
  userId: string;
  name: string;
  codeforcesId: string;
  totalPoints: number;
  totalSolved: number;
  rank: number;
};

export async function getPotdLeaderboard(): Promise<{
  ok: boolean;
  data?: LeaderboardEntry[];
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  await dbConnect();

  const users = await User.find(
    { potdTotalSolved: { $gt: 0 } },
    {
      name: 1,
      codeforcesId: 1,
      potdTotalPoints: 1,
      potdTotalSolved: 1,
    },
  ).sort({ potdTotalPoints: -1 });

  const data: LeaderboardEntry[] = users.map((u: any, idx: number) => ({
    userId: u._id.toString(),
    name: u.name ?? "",
    codeforcesId: u.codeforcesId ?? "",
    totalPoints: u.potdTotalPoints ?? 0,
    totalSolved: u.potdTotalSolved ?? 0,
    rank: idx + 1,
  }));

  return { ok: true, data };
}

// Streak Leaderboard

export type StreakEntry = {
  userId: string;
  name: string;
  codeforcesId: string;
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
};

export async function getStreakLeaderboard(): Promise<{
  ok: boolean;
  data?: StreakEntry[];
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  await dbConnect();

  const users = await User.find(
    { potdTotalSolved: { $gt: 0 } },
    {
      name: 1,
      codeforcesId: 1,
      potdCurrentStreak: 1,
      potdLongestStreak: 1,
      potdTotalSolved: 1,
    },
  )
    .sort({ potdCurrentStreak: -1, potdLongestStreak: -1 })
    .limit(50);

  const data: StreakEntry[] = users.map((u: any) => ({
    userId: u._id.toString(),
    name: u.name ?? "",
    codeforcesId: u.codeforcesId ?? "",
    currentStreak: u.potdCurrentStreak ?? 0,
    longestStreak: u.potdLongestStreak ?? 0,
    totalSolved: u.potdTotalSolved ?? 0,
  }));

  return { ok: true, data };
}
