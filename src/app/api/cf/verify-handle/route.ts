import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import User from "@/models/User";
import CFUser from "@/models/CFUser";
import { dbConnect } from "@/lib/mongodb";
import redis from "@/lib/redis";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const userDoc = await User.findById(session.user.id);
    if (!userDoc || !userDoc.codeforcesId) {
      return NextResponse.json(
        { error: "Codeforces ID not set on profile." },
        { status: 400 },
      );
    }

    const cfUserDoc = await CFUser.findOne({ userId: session.user.id });
    if (!cfUserDoc?.cfVerificationToken || cfUserDoc.cfVerified) {
      return NextResponse.json(
        { error: "Already verified or no token found." },
        { status: 400 },
      );
    }

    const handle = userDoc.codeforcesId;

    // Rate limit: maximum 1 verify attempt per 60 seconds per user
    const redisKey = `cf:verify:lock:${userDoc._id.toString()}`;
    const isLocked = await redis.get(redisKey);
    if (isLocked) {
      const ttl = await redis.ttl(redisKey);
      return NextResponse.json(
        { error: `Try again in ${ttl} seconds` },
        { status: 429 },
      );
    }

    // Global rate limit for any CF API call to prevent server IP bans
    const globalCfLimitKey = `cf:api:global_lock`;
    const cfLocked = await redis.set(globalCfLimitKey, "1", {
      NX: true,
      EX: 2,
    });
    if (!cfLocked) {
      return NextResponse.json(
        { error: "Codeforces is busy, please try again in a few seconds." },
        { status: 429 },
      );
    }

    await redis.set(redisKey, "1", { EX: 60 });

    const cfRes = await fetch(
      `https://codeforces.com/api/user.info?handles=${handle}`,
    );
    if (!cfRes.ok) {
      return NextResponse.json(
        { error: "Failed to communicate with Codeforces API." },
        { status: 502 },
      );
    }
    const cfData = await cfRes.json();

    if (
      cfData.status !== "OK" ||
      !cfData.result ||
      cfData.result.length === 0
    ) {
      return NextResponse.json(
        { error: "Handle not found on Codeforces." },
        { status: 404 },
      );
    }

    if (cfData.result[0].firstName === cfUserDoc.cfVerificationToken) {
      cfUserDoc.cfVerified = true;
      cfUserDoc.cfVerificationToken = "";
      cfUserDoc.cfVerificationRequestedAt = null;
      await cfUserDoc.save();
      return NextResponse.json({
        success: true,
        message: "Handle verified successfully.",
      });
    } else {
      return NextResponse.json(
        {
          error: `Token not found in CF profile. Make sure '${cfUserDoc.cfVerificationToken}' is in your First Name.`,
        },
        { status: 400 },
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
