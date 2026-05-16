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
import {
  computeWindowTimes,
  getTodayISTDateStr,
  computePoints,
} from "@/lib/potd-utils";

// ─── Public Actions ───────────────────────────────────────────────────────────

export type TodayChallengeResult = {
  challengeId: string;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  graceEnd: string; // ISO
  problem: {
    cfContestId: number;
    cfIndex: string;
    name: string;
    rating: number;
    tags: string[];
  };
  mySubmission: {
    status: "Pending" | "Accepted" | "Late" | "NotSolved" | "none";
    solvedAt: string | null;
    pointsAwarded: number;
  };
};

export async function getTodayChallenge(): Promise<{
  ok: boolean;
  data?: TodayChallengeResult;
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  await dbConnect();

  const now = new Date();
  const challenge = await DailyChallenge.findOne({
    windowStart: { $lte: now },
    windowEnd: { $gte: now },
  })
    .sort({ windowStart: -1 })
    .populate("problem");

  if (!challenge) return { ok: false, error: "No active challenge" };

  const sub = await POTDSubmission.findOne({
    userId: session.user.id,
    challengeId: challenge._id,
  });

  const problem = challenge.problem as any;

  return {
    ok: true,
    data: {
      challengeId: challenge._id.toString(),
      windowStart: challenge.windowStart.toISOString(),
      windowEnd: challenge.windowEnd.toISOString(),
      graceEnd: challenge.graceEnd.toISOString(),
      problem: {
        cfContestId: problem.cfContestId,
        cfIndex: problem.cfIndex,
        name: problem.name,
        rating: problem.rating,
        tags: problem.tags,
      },
      mySubmission: sub
        ? {
            status: sub.status,
            solvedAt: sub.solvedAt ? sub.solvedAt.toISOString() : null,
            pointsAwarded: sub.pointsAwarded,
          }
        : { status: "none", solvedAt: null, pointsAwarded: 0 },
    },
  };
}

// ─── Sync My Submission ────────────────────────────────────────────────────────

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

  // L2: advisory lock — prevents duplicate concurrent requests
  const advisoryKey = `potd:sync:lock:${userId}:${challengeId}`;
  const advisorySet = await redis.set(advisoryKey, "1", { NX: true, EX: 30 });
  if (!advisorySet) {
    await redis.del(rateLimitKey); // release rate limit on lock failure
    return { ok: false, error: "Sync already in progress" };
  }

  // L2.5: GLOBAL CF API Rate limit (Codeforces allows ~1 per second)
  // Ensures across all manual frontend syncs, we only hit CF API once every 1-2 seconds
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

  // L3: check if cron is running for this challenge
  const cronKey = `potd:cron:lock:${challengeId}`;
  const cronRunning = await redis.get(cronKey);
  if (cronRunning) {
    await redis.del(rateLimitKey);
    await redis.del(advisoryKey);
    return {
      ok: false,
      error: "Daily sync in progress — please try again in a minute",
    };
  }

  try {
    await dbConnect();

    const challenge =
      await DailyChallenge.findById(challengeId).populate("problem");
    if (!challenge) {
      return { ok: false, error: "Challenge not found" };
    }

    // Check existing submission — don't downgrade Accepted
    const existing = await POTDSubmission.findOne({ userId, challengeId });
    if (existing?.status === "Accepted") {
      return {
        ok: true,
        status: "Accepted",
        pointsAwarded: existing.pointsAwarded,
      };
    }

    const problem = challenge.problem as any;
    const now = new Date();
    const windowStart = challenge.windowStart as Date;
    const windowEnd = challenge.windowEnd as Date;
    const graceEnd = challenge.graceEnd as Date;

    // Fetch CF submissions
    const cfHandle = (session.user as any).codeforcesId as string;
    const cfUrl = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(cfHandle)}&from=1&count=${CF_SUBMISSIONS_COUNT}`;

    let cfSubs: any[] = [];
    try {
      const { data } = await axios.get(cfUrl, { timeout: 10_000 });
      if (data.status === "OK") {
        cfSubs = data.result;
      }
    } catch (err) {
      logger.warn("[syncMySubmission] CF API error", { err });
      return { ok: false, error: "Failed to reach Codeforces API" };
    }

    // Find first AC for this problem submitted after windowStart
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
      if (solvedAt <= windowEnd) {
        newStatus = "Accepted";
      } else if (solvedAt <= graceEnd) {
        newStatus = "Accepted"; // grace window: Accepted but 0 points
      } else {
        newStatus = "Late";
      }
    } else if (now > graceEnd) {
      newStatus = "NotSolved";
    }

    // Points only in main window (windowStart → windowEnd)
    if (newStatus === "Accepted" && solvedAt && solvedAt <= windowEnd) {
      const userDoc = await User.findById(userId);
      const currentStreak = userDoc?.potdCurrentStreak ?? 0;
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
      const prevStreak = (await User.findById(userId))?.potdCurrentStreak ?? 0;
      const newStreak = prevStreak + 1;
      await User.findByIdAndUpdate(userId, {
        $inc: {
          potdTotalPoints: pointsAwarded,
          potdTotalSolved: 1,
        },
        $max: { potdLongestStreak: newStreak },
        $set: { potdCurrentStreak: newStreak },
      });
    }

    revalidatePath("/internal/potd");

    return { ok: true, status: newStatus, pointsAwarded };
  } finally {
    await redis.del(advisoryKey);
    // rate-limit key stays until TTL expires naturally
  }
}

// ─── My Stats ─────────────────────────────────────────────────────────────────

export async function getMyPotdStats(): Promise<{
  ok: boolean;
  data?: {
    totalPoints: number;
    currentStreak: number;
    longestStreak: number;
    totalSolved: number;
    recentSubmissions: Array<{
      challengeId: string;
      status: string;
      solvedAt: string | null;
      pointsAwarded: number;
      problem: {
        cfContestId: number;
        cfIndex: string;
        name: string;
        rating: number;
      };
    }>;
  };
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  await dbConnect();

  const userDoc = await User.findById(session.user.id);
  if (!userDoc) return { ok: false, error: "User not found" };

  const subs = await POTDSubmission.find({
    userId: session.user.id,
    status: { $in: ["Accepted", "Late"] },
  })
    .sort({ solvedAt: -1 })
    .limit(20)
    .populate({ path: "challengeId", populate: { path: "problem" } });

  const recentSubmissions = subs.map((s: any) => {
    const challenge = s.challengeId as any;
    const problem = challenge?.problem as any;
    return {
      challengeId: challenge?._id?.toString() ?? "",
      status: s.status,
      solvedAt: s.solvedAt?.toISOString() ?? null,
      pointsAwarded: s.pointsAwarded,
      problem: {
        cfContestId: problem?.cfContestId ?? 0,
        cfIndex: problem?.cfIndex ?? "",
        name: problem?.name ?? "",
        rating: problem?.rating ?? 0,
      },
    };
  });

  return {
    ok: true,
    data: {
      totalPoints: userDoc.potdTotalPoints ?? 0,
      currentStreak: userDoc.potdCurrentStreak ?? 0,
      longestStreak: userDoc.potdLongestStreak ?? 0,
      totalSolved: userDoc.potdTotalSolved ?? 0,
      recentSubmissions,
    },
  };
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  userId: string;
  name: string;
  codeforcesId: string;
  totalPoints: number;
  totalSolved: number;
  currentStreak: number;
};

export async function getPotdLeaderboard(
  view: "weekly" | "monthly",
): Promise<{ ok: boolean; data?: LeaderboardEntry[]; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  await dbConnect();

  const now = new Date();
  let since: Date;
  if (view === "weekly") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const rows = await POTDSubmission.aggregate([
    {
      $match: {
        status: "Accepted",
        solvedAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: "$userId",
        totalPoints: { $sum: "$pointsAwarded" },
        totalSolved: { $sum: 1 },
      },
    },
    { $sort: { totalPoints: -1, totalSolved: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: { $toString: "$_id" },
        name: "$user.name",
        codeforcesId: "$user.codeforcesId",
        totalPoints: 1,
        totalSolved: 1,
        currentStreak: "$user.potdCurrentStreak",
      },
    },
  ]);

  return { ok: true, data: rows };
}

// ─── Past Problems ────────────────────────────────────────────────────────────

export type PastProblemEntry = {
  challengeId: string;
  windowStart: string;
  problem: {
    cfContestId: number;
    cfIndex: string;
    name: string;
    rating: number;
    tags: string[];
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
    .sort({ windowStart: -1 })
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
      problem: {
        cfContestId: p.cfContestId,
        cfIndex: p.cfIndex,
        name: p.name,
        rating: p.rating,
        tags: p.tags,
      },
      solvedBy: countMap.get(c._id.toString()) ?? 0,
    };
  });

  return { ok: true, data };
}

// ─── Streak Leaderboard ───────────────────────────────────────────────────────

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
