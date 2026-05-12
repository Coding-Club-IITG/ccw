"use client";

import { useState } from "react";
import styles from "../Lists.module.scss";

type Tab = "weekly" | "monthly" | "allTime";

const dummyLeaderboard = [
  { id: 1, name: "Alice Smith", handle: "alice_codes", points: { weekly: 850, monthly: 3200, allTime: 12500 }, streak: 12, totalSolved: 85 },
  { id: 2, name: "Bob Jones", handle: "bob_j", points: { weekly: 600, monthly: 2900, allTime: 11200 }, streak: 5, totalSolved: 72 },
  { id: 3, name: "Charlie Brown", handle: "charlie.b", points: { weekly: 950, monthly: 4100, allTime: 9800 }, streak: 21, totalSolved: 65 },
  { id: 4, name: "Diana Prince", handle: "diana_p", points: { weekly: 400, monthly: 1500, allTime: 5400 }, streak: 2, totalSolved: 40 },
  { id: 5, name: "Evan Wright", handle: "evan_w", points: { weekly: 150, monthly: 800, allTime: 4200 }, streak: 0, totalSolved: 31 },
  { id: 6, name: "Tourist", handle: "tourist", points: { weekly: 1500, monthly: 6000, allTime: 55000 }, streak: 45, totalSolved: 360 },
];

export default function LeaderboardClient() {
  const [activeTab, setActiveTab] = useState<Tab>("weekly");

  // Sort based on active tab points
  const sortedData = [...dummyLeaderboard].sort((a, b) => b.points[activeTab] - a.points[activeTab]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>POTD Leaderboard</h1>
        <p>Rankings based on Problem of the Day performance.</p>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === "weekly" ? styles.active : ""}`}
          onClick={() => setActiveTab("weekly")}
        >
          Past 1 Week
        </button>
        <button 
          className={`${styles.tab} ${activeTab === "monthly" ? styles.active : ""}`}
          onClick={() => setActiveTab("monthly")}
        >
          Past 1 Month
        </button>
        <button 
          className={`${styles.tab} ${activeTab === "allTime" ? styles.active : ""}`}
          onClick={() => setActiveTab("allTime")}
        >
          All Time
        </button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Member</th>
              <th>Points</th>
              <th>Current Streak</th>
              <th>Total Solved</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((user, index) => {
              const rank = index + 1;
              let rankClass = "";
              if (rank === 1) rankClass = styles.top1;
              if (rank === 2) rankClass = styles.top2;
              if (rank === 3) rankClass = styles.top3;

              return (
                <tr key={user.id}>
                  <td>
                    <span className={`${styles.rank} ${rankClass ? styles.rankBadge : ""} ${rankClass}`}>
                      {rank}
                    </span>
                  </td>
                  <td>
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{user.name}</span>
                      <span className={styles.userHandle}>@{user.handle}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.points}>
                      {user.points[activeTab].toLocaleString()}
                    </span>
                  </td>
                  <td>
                    {user.streak > 0 ? (
                      <span className={styles.streak}>
                        🔥 {user.streak}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className={styles.subText}>{user.totalSolved}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}