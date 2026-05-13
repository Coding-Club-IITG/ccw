"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import axios from "axios";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Problem from "@/models/Problem";
import DailyChallenge from "@/models/DailyChallenge";
import PotdSubmission from "@/models/PotdSubmission";
import { logger } from "@/lib/utils";
import { isAdmin } from "@/lib/roles";
import { computeWindowTimes, computePoints } from "@/lib/potd-utils";

async function checkAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = session.user as any;
  if (!isAdmin(user.role)) return null;
  return session;
}

// ─── Set Daily Problem ────────────────────────────────────────────────────────

/**
 * Fetch problem metadata from CF API, upsert Problem doc, create DailyChallenge.
 * `dateStr` = YYYY-MM-DD in IST.
 */
export async function setDailyProblem(
  dateStr: string,
  cfContestId: number,
  cfIndex: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await checkAdmin();
  if (!session) return { ok: false, error: "Forbidden" };

  if (!dateStr || !cfContestId || !cfIndex) {
    return { ok: false, error: "Missing required fields" };
  }

  // Validate dateStr
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: "Invalid date format (YYYY-MM-DD)" };
  }

  await dbConnect();

  const { windowStart, windowEnd, graceEnd } = computeWindowTimes(dateStr);

  // Check if this slot is already taken
  const existing = await DailyChallenge.findOne({ windowStart });
  if (existing) {
    return { ok: false, error: "A problem is already set for this date" };
  }

  // Fetch CF problem metadata
  let problemName: string;
  let problemRating: number;
  let problemTags: string[];

  try {
    const indexUpper = cfIndex.toUpperCase();
    const { data } = await axios.get(
      `https://codeforces.com/api/contest.standings?contestId=${cfContestId}&from=1&count=1`,
      { timeout: 10_000 },
    );
    if (data.status !== "OK") {
      return { ok: false, error: `CF API error: ${data.comment ?? "unknown"}` };
    }
    const cfProblem = (data.result.problems as any[]).find(
      (p) => p.index.toUpperCase() === indexUpper,
    );
    if (!cfProblem) {
      return { ok: false, error: `Problem ${cfIndex} not found in contest ${cfContestId}` };
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
    setBy: session.user.id,
  });

  logger.info("[setDailyProblem] Created", { dateStr, cfContestId, cfIndex });
  revalidatePath("/internal/potd");

  return { ok: true };
}

// ─── Get Scheduled Challenges ─────────────────────────────────────────────────

export type ScheduledChallenge = {
  id: string;
  dateStr: string; // YYYY-MM-DD in IST
  windowStart: string;
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

  const now = new Date();
  const next8Days = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  const challenges = await DailyChallenge.find({
    windowStart: { $gte: now, $lte: next8Days },
  })
    .sort({ windowStart: 1 })
    .populate("problem");

  const data: ScheduledChallenge[] = challenges.map((c: any) => {
    const p = c.problem as any;
    const istMs = c.windowStart.getTime() + 5.5 * 60 * 60 * 1000;
    const istDate = new Date(istMs).toISOString().slice(0, 10);
    return {
      id: c._id.toString(),
      dateStr: istDate,
      windowStart: c.windowStart.toISOString(),
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

// ─── Delete Scheduled Challenge ───────────────────────────────────────────────

export async function deleteScheduledChallenge(
  challengeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await checkAdmin();
  if (!session) return { ok: false, error: "Forbidden" };

  await dbConnect();

  const challenge = await DailyChallenge.findById(challengeId);
  if (!challenge) return { ok: false, error: "Challenge not found" };

  const now = new Date();
  if (challenge.windowStart <= now) {
    return { ok: false, error: "Cannot delete a challenge that has already started" };
  }

  await DailyChallenge.deleteOne({ _id: challengeId });
  revalidatePath("/internal/potd");

  return { ok: true };
}

// ─── Get Pending Submissions ──────────────────────────────────────────────────

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

  const subs = await PotdSubmission.find({
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

// ─── Force Sync User ──────────────────────────────────────────────────────────

/**
 * Admin: force a CF sync for a specific user/challenge.
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
  if (!targetUser.cfVerified || !targetUser.codeforcesId) {
    return { ok: false, error: "User's CF handle not verified" };
  }

  const challenge = await DailyChallenge.findById(challengeId).populate("problem");
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
    const currentStreak = targetUser.potdCurrentStreak ?? 0;
    pointsAwarded = computePoints(
      problem.rating,
      solvedAt.getTime(),
      windowStart.getTime(),
      windowEnd.getTime(),
      currentStreak,
    );
  }

  const prevSub = await PotdSubmission.findOneAndUpdate(
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
    const prevStreak = targetUser.potdCurrentStreak ?? 0;
    const newStreak = prevStreak + 1;
    await User.findByIdAndUpdate(targetUserId, {
      $inc: { potdTotalPoints: pointsAwarded, potdTotalSolved: 1 },
      $max: { potdLongestStreak: newStreak },
      $set: { potdCurrentStreak: newStreak },
    });
  }

  logger.info("[forceSyncUser] Synced", {
    targetUserId,
    challengeId,
    newStatus,
  });
  revalidatePath("/internal/potd");

  return { ok: true, status: newStatus };
}
