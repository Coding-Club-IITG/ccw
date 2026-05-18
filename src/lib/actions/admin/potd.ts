"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import axios from "axios";
import dbConnect from "@/lib/mongodb";
import redis from "@/lib/redis";
import User from "@/models/User";
import CFUser from "@/models/CFUser";
import Problem from "@/models/POTDProblem";
import DailyChallenge from "@/models/POTDDailyChallenge";
import POTDSubmission from "@/models/POTDSubmission";

[User, CFUser, Problem, DailyChallenge, POTDSubmission].forEach(
  (m) => m && m.init && m.init(),
);

import { logger } from "@/lib/utils";
import { canSetPOTD } from "@/lib/roles";
import { IST_OFFSET_MS } from "@/lib/constants";
import {
  computeWindowTimes,
  getTodayISTDateStr,
  computePoints,
  windowStartToISTDateStr,
} from "@/lib/potd-utils";

async function checkAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = session.user as any;
  if (!canSetPOTD(user.role)) return null;
  return session;
}

// Set Daily Problem

/**
 * Fetch problem metadata from CF API, upsert Problem doc, create DailyChallenge
 * `dateStr` = YYYY-MM-DD in IST. `difficulty` = Easy | Medium | Hard.
 * Same-day scheduling is allowed; the challenge window ends at EOD IST.
 */
export async function setDailyProblem(
  dateStr: string,
  cfContestId: number,
  cfIndex: string,
  difficulty: "Easy" | "Medium" | "Hard",
): Promise<{ ok: boolean; error?: string }> {
  const session = await checkAdmin();
  if (!session) return { ok: false, error: "Forbidden" };

  if (!dateStr || !cfContestId || !cfIndex || !difficulty) {
    return { ok: false, error: "Missing required fields" };
  }

  // Validate dateStr
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: "Invalid date format (YYYY-MM-DD)" };
  }

  // Allow today and up to 10 days ahead; reject past dates
  const todayIST = getTodayISTDateStr();
  if (dateStr < todayIST) {
    return { ok: false, error: "Cannot schedule problems for past dates" };
  }

  const tenDaysAhead = (() => {
    const d = new Date(Date.now() + IST_OFFSET_MS);
    d.setUTCDate(d.getUTCDate() + 10);
    return d.toISOString().slice(0, 10);
  })();
  if (dateStr > tenDaysAhead) {
    return { ok: false, error: "Cannot schedule more than 10 days in advance" };
  }

  await dbConnect();

  const { windowStart, windowEnd, graceEnd } = computeWindowTimes(dateStr);

  // Check if this (date, difficulty) slot is already taken
  const existing = await DailyChallenge.findOne({ windowStart, difficulty });
  if (existing) {
    return {
      ok: false,
      error: `A ${difficulty} problem is already set for this date`,
    };
  }

  // Check if this problem has already been used on any previous day
  const existingProblem = await Problem.findOne({
    cfContestId,
    cfIndex: cfIndex.toUpperCase(),
  });

  if (existingProblem) {
    const previousUsage = await DailyChallenge.findOne({
      problem: existingProblem._id,
    });
    if (previousUsage) {
      const usedDate = windowStartToISTDateStr(previousUsage.windowStart);
      return {
        ok: false,
        error: `This problem was already used for a POTD on ${usedDate}`,
      };
    }
  }

  // Fetch CF problem metadata (cached 24h)
  let problemName: string;
  let problemRating: number;
  let problemTags: string[];

  try {
    const indexUpper = cfIndex.toUpperCase();
    const CACHE_KEY = "cf:problemset:problems:v1";

    let allProblems: any[];
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      allProblems = JSON.parse(cached);
    } else {
      const { data } = await axios.get(
        "https://codeforces.com/api/problemset.problems",
        { timeout: 30_000 },
      );
      if (data.status !== "OK") {
        return {
          ok: false,
          error: `CF API error: ${data.comment ?? "unknown"}`,
        };
      }
      allProblems = data.result.problems;
      await redis.set(CACHE_KEY, JSON.stringify(allProblems), { EX: 86_400 });
    }

    const cfProblem = allProblems.find(
      (p) =>
        p.contestId === cfContestId && p.index.toUpperCase() === indexUpper,
    );
    if (!cfProblem) {
      return {
        ok: false,
        error: `Problem ${cfContestId}${cfIndex} not found in CF problemset`,
      };
    }
    problemName = cfProblem.name;
    problemRating = cfProblem.rating ?? 0;
    problemTags = cfProblem.tags ?? [];
  } catch (err) {
    logger.error("[setDailyProblem] CF API fetch failed", { err });
    return { ok: false, error: "Failed to fetch problem from Codeforces" };
  }

  // Upsert Problem doc
  const problemDoc = await Problem.findOneAndUpdate(
    { cfContestId, cfIndex: cfIndex.toUpperCase() },
    { $set: { name: problemName, rating: problemRating, tags: problemTags } },
    { upsert: true, new: true },
  );

  await DailyChallenge.create({
    windowStart,
    windowEnd,
    graceEnd,
    problem: problemDoc._id,
    difficulty,
    setBy: session.user.id,
  });

  logger.info("[setDailyProblem] Created", {
    dateStr,
    cfContestId,
    cfIndex,
    difficulty,
  });
  revalidatePath("/internal/potd");

  return { ok: true };
}

// Get Scheduled Challenges

export type ScheduledChallenge = {
  id: string;
  dateStr: string;
  windowStart: string;
  windowEnd: string;
  difficulty: "Easy" | "Medium" | "Hard";
  isToday: boolean;
  problem: {
    cfContestId: number;
    cfIndex: string;
    name: string;
    rating: number;
  };
};

export async function getScheduledChallenges(): Promise<{
  ok: boolean;
  data?: ScheduledChallenge[];
  error?: string;
}> {
  const session = await checkAdmin();
  if (!session) return { ok: false, error: "Forbidden" };

  await dbConnect();

  const todayIST = getTodayISTDateStr();
  const { windowStart: todayWindowStart } = computeWindowTimes(todayIST);
  // Show today + up to 10 days ahead
  const futureLimit = new Date(
    todayWindowStart.getTime() + 11 * 24 * 60 * 60 * 1000,
  );

  const challenges = await DailyChallenge.find({
    windowStart: { $gte: todayWindowStart, $lte: futureLimit },
  })
    .sort({ windowStart: 1, difficulty: 1 })
    .populate("problem");

  const data: ScheduledChallenge[] = challenges.map((c: any) => {
    const p = c.problem as any;
    const istDate = windowStartToISTDateStr(c.windowStart);
    return {
      id: c._id.toString(),
      dateStr: istDate,
      windowStart: c.windowStart.toISOString(),
      windowEnd: c.windowEnd.toISOString(),
      difficulty: c.difficulty,
      isToday: istDate === todayIST,
      problem: {
        cfContestId: p.cfContestId,
        cfIndex: p.cfIndex,
        name: p.name,
        rating: p.rating,
      },
    };
  });

  return { ok: true, data };
}

// Delete Scheduled Challenge

/**
 * Deletes a scheduled challenge
 */
export async function deleteScheduledChallenge(
  challengeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await checkAdmin();
  if (!session) return { ok: false, error: "Forbidden" };

  await dbConnect();

  const challenge = await DailyChallenge.findById(challengeId);
  if (!challenge) return { ok: false, error: "Challenge not found" };

  const now = new Date();
  // Only block deletion after the window has fully ended (including grace)
  if (challenge.graceEnd < now) {
    return {
      ok: false,
      error: "Cannot delete a challenge that has already ended",
    };
  }

  await DailyChallenge.deleteOne({ _id: challengeId });
  revalidatePath("/internal/potd");

  return { ok: true };
}

// Get Pending Submissions

export type PendingSubmissionEntry = {
  submissionId: string;
  userId: string;
  userName: string;
  codeforcesId: string;
  status: string;
  lastCheckedAt: string | null;
};

export async function getPendingSubmissions(challengeId: string): Promise<{
  ok: boolean;
  data?: PendingSubmissionEntry[];
  error?: string;
}> {
  const session = await checkAdmin();
  if (!session) return { ok: false, error: "Forbidden" };

  await dbConnect();

  const subs = await POTDSubmission.find({
    challengeId,
    status: "Pending",
  }).populate("userId", "name codeforcesId");

  const data: PendingSubmissionEntry[] = subs.map((s: any) => {
    const u = s.userId as any;
    return {
      submissionId: s._id.toString(),
      userId: u._id.toString(),
      userName: u.name ?? "",
      codeforcesId: u.codeforcesId ?? "",
      status: s.status,
      lastCheckedAt: s.lastCheckedAt ? s.lastCheckedAt.toISOString() : null,
    };
  });

  return { ok: true, data };
}

// Force Sync User

/**
 * Admin: force a CF sync for a specific user/challenge
 * Respects all locks — aborts if cron is already running.
 */
export async function forceSyncUser(
  targetUserId: string,
  challengeId: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const session = await checkAdmin();
  if (!session) return { ok: false, error: "Forbidden" };

  await dbConnect();

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return { ok: false, error: "User not found" };
  if (!targetUser.codeforcesId) {
    return { ok: false, error: "User's CF handle not set" };
  }

  const targetCFUser = await CFUser.findOne({ userId: targetUserId });
  if (!targetCFUser?.cfVerified) {
    return { ok: false, error: "User's CF handle not verified" };
  }

  const challenge =
    await DailyChallenge.findById(challengeId).populate("problem");
  if (!challenge) return { ok: false, error: "Challenge not found" };

  const problem = challenge.problem as any;
  const windowStart = challenge.windowStart as Date;
  const windowEnd = challenge.windowEnd as Date;
  const graceEnd = challenge.graceEnd as Date;
  const now = new Date();

  const cfUrl = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(targetUser.codeforcesId)}&from=1&count=50`;
  let cfSubs: any[] = [];
  try {
    const { data } = await axios.get(cfUrl, { timeout: 10_000 });
    if (data.status === "OK") cfSubs = data.result;
  } catch (err) {
    logger.warn("[forceSyncUser] CF API error", { err });
    return { ok: false, error: "Failed to reach Codeforces API" };
  }

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
    const currentStreak = targetCFUser.potdCurrentStreak ?? 0;
    pointsAwarded = computePoints(
      problem.rating,
      solvedAt.getTime(),
      windowStart.getTime(),
      windowEnd.getTime(),
      currentStreak,
    );
  }

  const prevSub = await POTDSubmission.findOneAndUpdate(
    { userId: targetUserId, challengeId },
    {
      $set: {
        status: newStatus,
        solvedAt,
        pointsAwarded,
        solvedInGrace:
          newStatus === "Accepted" && solvedAt !== null && solvedAt > windowEnd,
        lastCheckedAt: now,
      },
      $setOnInsert: { userId: targetUserId, challengeId },
    },
    { upsert: true, new: false },
  );

  const wasAlreadyAccepted = prevSub?.status === "Accepted";
  if (newStatus === "Accepted" && !wasAlreadyAccepted) {
    const prevStreak = targetCFUser.potdCurrentStreak ?? 0;
    const newStreak = prevStreak + 1;
    await CFUser.findOneAndUpdate(
      { userId: targetUserId },
      {
        $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 },
        $max: { potdLongestStreak: newStreak },
        $set: { potdCurrentStreak: newStreak },
      },
    );
  }

  logger.info("[forceSyncUser] Synced", {
    targetUserId,
    challengeId,
    newStatus,
  });
  revalidatePath("/internal/potd");

  return { ok: true, status: newStatus };
}
