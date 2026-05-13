"use client";

import { useState, useEffect } from "react";
import styles from "./SetProblem.module.scss";
import {
  setDailyProblem,
  getScheduledChallenges,
  deleteScheduledChallenge,
  type ScheduledChallenge,
} from "@/lib/actions/admin/potd";

type FormData = {
  date: string;
  problemId: string;
};

const getNext7Days = (): string[] => {
  const dates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const nowMs = Date.now() + 5.5 * 60 * 60 * 1000; // shift to IST
    const istDate = new Date(nowMs);
    istDate.setUTCDate(istDate.getUTCDate() + i);
    dates.push(istDate.toISOString().slice(0, 10));
  }
  return dates;
};

export default function SetProblemClient() {
  const availableDates = getNext7Days();
  const [problems, setProblems] = useState<ScheduledChallenge[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ date: "", problemId: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchScheduled();
  }, []);

  async function fetchScheduled() {
    setLoadingInitial(true);
    try {
      const result = await getScheduledChallenges();
      if (result.ok && result.data) {
        setProblems(result.data);
      }
    } finally {
      setLoadingInitial(false);
    }
  }

  const handleAddNew = () => {
    setIsEditing("new");
    setFormError(null);
    const firstAvailableDate =
      availableDates.find((d) => !problems.some((p) => p.dateStr === d)) ||
      availableDates[0];
    setFormData({ date: firstAvailableDate, problemId: "" });
  };

  const handleCancelEdit = () => {
    setIsEditing(null);
    setFormData({ date: "", problemId: "" });
    setFormError(null);
  };

  const handleSave = async () => {
    if (!formData.date || !formData.problemId) {
      setFormError("Date and Problem ID are required.");
      return;
    }
    const idMatches = formData.problemId.match(/^(\d+)\s*([A-Z0-9]+)$/i);
    if (!idMatches) {
      setFormError("Invalid Problem ID. Use format like '158A' or '1234B1'.");
      return;
    }
    const cfContestId = parseInt(idMatches[1], 10);
    const cfIndex = idMatches[2].toUpperCase();
    setIsSaving(true);
    setFormError(null);
    try {
      const result = await setDailyProblem(formData.date, cfContestId, cfIndex);
      if (!result.ok) {
        setFormError(result.error ?? "Failed to save problem");
        return;
      }
      setIsEditing(null);
      setFormData({ date: "", problemId: "" });
      await fetchScheduled();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this scheduled problem?")) return;
    const result = await deleteScheduledChallenge(id);
    if (!result.ok) {
      alert(result.error ?? "Failed to delete");
      return;
    }
    await fetchScheduled();
  };

  const remainingSlots = 7 - problems.length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerFlex}>
          <div>
            <h1>Manage Upcoming Problems</h1>
            <p>Schedule up to 7 days of Codeforces problems in advance.</p>
          </div>
          <button
            className={styles.addBtn}
            onClick={handleAddNew}
            disabled={isEditing !== null || remainingSlots === 0}
          >
            + Add Problem ({remainingSlots} left)
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {loadingInitial && (
          <p style={{ color: "#666" }}>Loading scheduled problems...</p>
        )}

        {!loadingInitial && problems.length === 0 && isEditing !== "new" && (
          <div className={styles.emptyState}>
            No upcoming problems scheduled. Click &quot;Add Problem&quot; to get started.
          </div>
        )}

        {isEditing === "new" && (
          <div className={styles.editCard}>
            <div className={styles.editHeader}>
              <h3>Schedule New Problem</h3>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="editDate">Date (IST)</label>
                <select
                  id="editDate"
                  title="Select Date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                >
                  {availableDates.map((d) => (
                    <option
                      key={d}
                      value={d}
                      disabled={problems.some((p) => p.dateStr === d)}
                    >
                      {new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Problem ID</label>
                <input
                  type="text"
                  title="Codeforces Problem ID (e.g., 158A)"
                  placeholder="e.g., 158A"
                  value={formData.problemId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      problemId: e.target.value.toUpperCase(),
                    })
                  }
                  disabled={isSaving}
                />
              </div>
            </div>
            {formError && (
              <p
                style={{
                  color: "#e11d48",
                  fontSize: "0.875rem",
                  marginBottom: "0.5rem",
                }}
              >
                {formError}
              </p>
            )}
            <div className={styles.actions}>
              <button
                className={styles.cancelBtn}
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Fetch & Save"}
              </button>
            </div>
          </div>
        )}

        {problems.map((prob) => (
          <div key={prob.id} className={styles.problemCard}>
            <div className={styles.cardHeader}>
              <span className={styles.dateLabel}>
                {new Date(prob.dateStr + "T00:00:00Z").toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  },
                )}
              </span>
              <div className={styles.cardActions}>
                <button
                  title="Delete Problem"
                  className={styles.iconBtnDestructive}
                  onClick={() => handleDelete(prob.id)}
                  disabled={isEditing !== null}
                >
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
            <div className={styles.cardBody}>
              <h4>{prob.problem.name}</h4>
              <div className={styles.meta}>
                <span className={styles.difficulty}>
                  Rating: {prob.problem.rating || "Unrated"}
                </span>
                <a
                  href={`https://codeforces.com/problemset/problem/${prob.problem.cfContestId}/${prob.problem.cfIndex}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.urlLink}
                >
                  View on CF ↗
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
