import axios from "axios";
import User from "@/models/User";
import CFUser from "@/models/CFUser";
import { logger } from "@/lib/utils";
import dbConnect from "@/lib/mongodb";

const CODEFORCES_API_URL = "https://codeforces.com/api/user.info";

export async function syncCodeforcesRatings() {
  logger.info("[CF-Sync] Starting Codeforces rating sync...");
  await dbConnect();

  try {
    // 1. Get all users who have set a codeforcesId (codeforcesId remains on User)
    const usersWithCF = await User.find({
      codeforcesId: { $exists: true, $ne: "" },
    }).select("_id codeforcesId");

    if (usersWithCF.length === 0) {
      logger.info("[CF-Sync] No users with Codeforces IDs found.");
      return;
    }

    // 2. Build handle → userId[] map (handles are case-insensitive on CF)
    const handleToUserIds: Record<string, string[]> = {};
    usersWithCF.forEach((u) => {
      const h = u.codeforcesId.trim();
      if (!handleToUserIds[h.toLowerCase()]) {
        handleToUserIds[h.toLowerCase()] = [];
      }
      handleToUserIds[h.toLowerCase()].push(u._id.toString());
    });

    const handles = Object.keys(handleToUserIds).join(";");

    // 3. Fetch from Codeforces API
    logger.info(
      `[CF-Sync] Fetching data for ${Object.keys(handleToUserIds).length} unique handles...`,
    );
    const response = await axios.get(
      `${CODEFORCES_API_URL}?handles=${handles}`,
    );

    if (response.data.status !== "OK") {
      throw new Error(`Codeforces API error: ${response.data.comment}`);
    }

    const cfResults = response.data.result;

    // 4. Upsert CFUser entries — only update CF profile fields (rating, rank,
    //    avatar, etc.).  POTD stats and verification flags are NOT touched here;
    //    they are managed by potdSync and the verify-handle route respectively.
    const bulkOps = cfResults
      .map((cfData: any) => {
        const lowerHandle = cfData.handle.toLowerCase();
        const userIds = handleToUserIds[lowerHandle];

        if (!userIds) return null;

        return {
          updateOne: {
            filter: { userId: userIds[0] },
            update: {
              $set: {
                handle: cfData.handle,
                rating: cfData.rating || 0,
                rank: cfData.rank || "Unrated",
                maxRating: cfData.maxRating || 0,
                maxRank: cfData.maxRank || "Unrated",
                avatar: cfData.avatar || "",
                lastUpdated: new Date(),
              },
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean);

    if (bulkOps.length > 0) {
      await CFUser.bulkWrite(bulkOps);
      logger.info(
        `[CF-Sync] Successfully updated ${bulkOps.length} CFUser records.`,
      );
    }
  } catch (error: any) {
    logger.error("[CF-Sync] Error during sync:", error.message);
  }
}
