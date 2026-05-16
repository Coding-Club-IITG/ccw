import LeaderboardClient from "./LeaderboardClient";
import { getPotdLeaderboard } from "@/lib/actions/potd";

export default async function PotdLeaderboardPage() {
  const [weekly, monthly] = await Promise.all([
    getPotdLeaderboard("weekly"),
    getPotdLeaderboard("monthly"),
  ]);

  return (
    <LeaderboardClient
      initialWeekly={weekly.data ?? []}
      initialMonthly={monthly.data ?? []}
    />
  );
}
