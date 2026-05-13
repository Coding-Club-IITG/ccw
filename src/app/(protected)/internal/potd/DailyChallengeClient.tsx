"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./Potd.module.scss";

export default function DailyChallengeClient({ cfVerified }: { cfVerified: boolean }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [hoursLeft, setHoursLeft] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const calculateTimeLeft = () => {
      const now = new Date();
      // Target 5:00 PM today (or next day)
      const target = new Date();
      target.setHours(17, 0, 0, 0); // 17:00 local time
      
      // If past 5:00 PM today, target 5:00 PM tomorrow
      if (now.getTime() > target.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      
      const diff = target.getTime() - now.getTime();
      
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setHoursLeft(diff / (1000 * 60 * 60));
      
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSync = () => {
    setSyncing(true);
    // Fake sync delay
    setTimeout(() => {
      setSyncing(false);
      alert("Sync complete! You have earned 150 points for solving this problem.");
    }, 1500);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <span className={styles.problemId}>Codeforces 1722-C</span>
            <h1 className={styles.title}>Jumping on Tiles</h1>
          </div>
          <div className={styles.rating}>1500</div>
        </div>
        
        <div className={styles.tags}>
          <span>dp</span>
          <span>greedy</span>
          <span>strings</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.label}>Time Remaining</span>
            <span 
              className={`${styles.value} ${styles.timerValue}`}
              style={{
                color: !isClient ? "inherit" : hoursLeft > 10 ? "#10b981" : hoursLeft < 2 ? "#e11d48" : "#f59e0b"
              }}
            >
              {isClient ? timeLeft : "00:00:00"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Solved Today</span>
            <span className={styles.value}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#10b981' }}>
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              42 Members
            </span>
          </div>
        </div>

        <div className={styles.actionArea}>
          {cfVerified ? (
            <button 
              className={styles.syncBtn} 
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? "Syncing..." : "Sync My Answer"}
            </button>
          ) : (
            <div className={styles.verifyPrompt}>
              <p>Your Codeforces ID is unverified. Please verify it to participate.</p>
              <Link href="/internal/profile" className={styles.verifyBtn}>
                Verify ID
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}