import { getTodayChallenge } from "@/lib/actions/potd";
import { getCFStatus } from "@/lib/actions/cfStatus";
import DailyChallengeClient from "./DailyChallengeClient";

export default async function PotdPage() {
  const cfStatusResult = await getCFStatus();
  const cfVerified = cfStatusResult.ok
    ? (cfStatusResult.cfVerified ?? false)
    : false;

  const challengeResult = await getTodayChallenge();

  return (
    <div>
      <h1 style={{ marginBottom: "2rem" }}>Daily Challenge</h1>
      <DailyChallengeClient
        cfVerified={cfVerified}
        initialData={challengeResult.data ?? null}
      />
    </div>
  );
}
