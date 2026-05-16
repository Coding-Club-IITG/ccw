import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTodayChallenge } from "@/lib/actions/potd";
import DailyChallengeClient from "./DailyChallengeClient";

export default async function PotdPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const user = session?.user as any;
  const cfVerified = user?.cfVerified || false;

  const challengeResult = await getTodayChallenge();

  return (
    <div>
      <h1 style={{ marginBottom: "2rem" }}>Daily Challenge</h1>
      <DailyChallengeClient
        cfVerified={cfVerified}
        initialChallenge={challengeResult.data ?? null}
      />
    </div>
  );
}
