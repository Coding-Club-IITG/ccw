"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./Potd.module.scss";
import { syncMySubmission, type TodayChallengeResult } from "@/lib/actions/potd";

type Props = {
  cfVerified: boolean;
  initialChallenge: TodayChallengeResult | null;
};

export default function DailyChallengeClient({ cfVerified, initialChallenge }: Props) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [hoursLeft, setHoursLeft] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [challenge, setChallenge] = useState(initialChallenge);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Countdown to windowEnd (main window close) or graceEnd
  useEffect(() => {
    setIsClient(true);

    const getDeadline = () => {
      if (challenge) {
        const windowEnd = new Date(challenge.windowEnd);
        const graceEnd = new Date(challenge.graceEnd);
        const now = new Date();
        if (now <= windowEnd) return windowEnd;
        if (now <= graceEnd) return graceEnd;
        return graceEnd; // past grace — show 0
      }
      // Fallback: next 5:00 PM IST
      const nowMs = Date.now();
      const istMs = nowMs + 5.5 * 60 * 60 * 1000;
      const istDate = new Date(istMs);
      const nextWindowEnd = new Date(
        Date.UTC(
          istDate.getUTCFullYear(),
          istDate.getUTCMonth(),
          istDate.getUTCDate() + 1,
          11,
          29,
          59,
        ),
      );
      return nextWindowEnd;
    };

    const calculateTimeLeft = () => {
      const target = getDeadline();
      const diff = Math.max(0, target.getTime() - Date.now());
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setHoursLeft(diff / (1000 * 60 * 60));
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge]);

  const handleSync = async () => {
    if (!challenge) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncMySubmission(challenge.challengeId);
      if (result.ok) {
        setChallenge((prev) =>
          prev
            ? {
                ...prev,
                mySubmission: {
                  status: result.status as any,
                  solvedAt: null,
                  pointsAwarded: result.pointsAwarded ?? 0,
                },
              }
            : prev,
        );
        if (result.status === "Accepted") {
          alert(
            result.pointsAwarded && result.pointsAwarded > 0
              ? `Sync complete! You earned ${result.pointsAwarded} points.`
              : "Sync complete! Solved in grace window — 0 points.",
          );
        } else if (result.status === "Pending") {
          alert("No accepted submission found yet. Try again later.");
        } else if (result.status === "NotSolved") {
          alert("The window has closed and no solve was detected.");
        }
      } else {
        setSyncError(result.error ?? "Sync failed");
      }
    } catch {
      setSyncError("An unexpected error occurred");
    } finally {
      setSyncing(false);
    }
  };

  const myStatus = challenge?.mySubmission?.status ?? "none";
  const alreadyAccepted = myStatus === "Accepted";
  const isInGrace =
    challenge &&
    isClient &&
    new Date() > new Date(challenge.windowEnd) &&
    new Date() <= new Date(challenge.graceEnd);

  if (!challenge) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p style={{ color: "#666", textAlign: "center", padding: "2rem 0" }}>
            No challenge active right now. Check back at 5:00 PM IST!
          </p>
        </div>
      </div>
    );
  }

  const { problem } = challenge;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <span className={styles.problemId}>
              Codeforces {problem.cfContestId}-{problem.cfIndex}
            </span>
            <h1 className={styles.title}>{problem.name}</h1>
          </div>
          <div className={styles.rating}>{problem.rating || "Unrated"}</div>
        </div>

        <div className={styles.tags}>
          {problem.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.label}>
              {isInGrace ? "Grace Window Ends" : "Window Closes"}
            </span>
            <span
              className={`${styles.value} ${styles.timerValue}`}
              style={{
                color: !isClient
                  ? "inherit"
                  : hoursLeft > 10
                    ? "#10b981"
                    : hoursLeft < 2
                      ? "#e11d48"
                      : "#f59e0b",
              }}
            >
              {isClient ? timeLeft : "00:00:00"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Your Status</span>
            <span className={styles.value}>
              {alreadyAccepted ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: "8px", color: "#10b981" }}
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Solved ({challenge.mySubmission.pointsAwarded} pts)
                </>
              ) : myStatus === "Pending" ? (
                "Not synced yet"
              ) : myStatus === "NotSolved" ? (
                "Not solved"
              ) : (
                "—"
              )}
            </span>
          </div>
        </div>

        {syncError && (
          <p style={{ color: "#e11d48", marginBottom: "1rem", fontSize: "0.9rem" }}>
            {syncError}
          </p>
        )}

        <div className={styles.actionArea}>
          {cfVerified ? (
            <>
              <a
                href={`https://codeforces.com/problemset/problem/${problem.cfContestId}/${problem.cfIndex}`}
                target="_blank"
                rel="noreferrer"
                className={styles.syncBtn}
                style={{ textAlign: "center", textDecoration: "none" }}
              >
                Open Problem
              </a>
              {!alreadyAccepted && (
                <button
                  className={styles.syncBtn}
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? "Syncing..." : "Sync My Answer"}
                </button>
              )}
            </>
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
