"use client";

import { useState } from "react";
import styles from "../Lists.module.scss";

type StreakTab = "current" | "max";

const dummyStreakData = [
  { id: 1, name: "Tourist", handle: "tourist", currentStreak: 45, maxStreak: 120, totalSolved: 360 },
  { id: 2, name: "Charlie Brown", handle: "charlie.b", currentStreak: 21, maxStreak: 35, totalSolved: 65 },
  { id: 3, name: "Alice Smith", handle: "alice_codes", currentStreak: 12, maxStreak: 15, totalSolved: 85 },
  { id: 4, name: "Bob Jones", handle: "bob_j", currentStreak: 5, maxStreak: 50, totalSolved: 72 },
  { id: 5, name: "Diana Prince", handle: "diana_p", currentStreak: 2, maxStreak: 10, totalSolved: 40 },
  { id: 6, name: "Evan Wright", handle: "evan_w", currentStreak: 0, maxStreak: 25, totalSolved: 31 },
];

export default function StreakLeaderboardClient() {
  const [sortParam, setSortParam] = useState<StreakTab>("current");

  // Sort based on selected state
  const sortedData = [...dummyStreakData].sort((a, b) => {
    const valA = sortParam === "current" ? a.currentStreak : a.maxStreak;
    const valB = sortParam === "current" ? b.currentStreak : b.maxStreak;
    return valB - valA;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerFlex}>
          <div>
            <h1>Streak Leaderboard</h1>
            <p>Rankings based on consecutive days of solving the POTD.</p>
          </div>
          <div className={styles.sortControls}>
            <label htmlFor="streakSort" className={styles.sortLabel}>Sort By:</label>
            <select 
              id="streakSort" 
              className={styles.sortSelect}
              value={sortParam} 
              onChange={(e) => setSortParam(e.target.value as StreakTab)}
            >
              <option value="current">Current Streak</option>
              <option value="max">Max Streak All Time</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Member</th>
              <th 
                className={sortParam === "current" ? styles.activeSortHeader : styles.sortHeader}
                onClick={() => setSortParam("current")}
              >
                Current Streak {sortParam === "current" && "▼"}
              </th>
              <th 
                className={sortParam === "max" ? styles.activeSortHeader : styles.sortHeader}
                onClick={() => setSortParam("max")}
              >
                Max Streak {sortParam === "max" && "▼"}
              </th>
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
                    {user.currentStreak > 0 ? (
                      <span className={styles.streak}>
                        🔥 {user.currentStreak}
                      </span>
                    ) : (
                      <span className={styles.subText}>-</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.maxStreakWrapper}>
                      <span className={styles.maxStreakIcon}>⚡</span> {user.maxStreak}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
