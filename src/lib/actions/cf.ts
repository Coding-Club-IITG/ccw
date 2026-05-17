"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import User from "@/models/User";
import { dbConnect } from "@/lib/mongodb";
import { logger } from "@/lib/utils";

function generateToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "POTD-";
  for (let i = 0; i < 4; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function requestHandleVerification(
  handle: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) return { ok: false, error: "Unauthorized" };

    await dbConnect();
    const token = generateToken();

    await User.findByIdAndUpdate(session.user.id, {
      codeforcesId: handle,
      cfVerificationToken: token,
      cfVerificationRequestedAt: new Date(),
      cfVerified: false,
    });

    return { ok: true, token };
  } catch (err) {
    logger.error("[cf.ts] requestHandleVerification error:", err);
    return { ok: false, error: "Failed to generate verification token." };
  }
}
