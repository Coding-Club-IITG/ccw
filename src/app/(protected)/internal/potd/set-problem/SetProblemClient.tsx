"use client";

import { useState } from "react";
import styles from "./SetProblem.module.scss";

type PlannedProblem = {
  id: string;
  date: string; // YYYY-MM-DD
  problemId: string; // e.g. "158A"
  url: string;
  name: string;
  difficulty: string;
};

// Next 7 days
const getNext7Days = () => {
  const dates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const initialDummyData: PlannedProblem[] = [
  { id: "1", date: getNext7Days()[0], problemId: "158A", url: "https://codeforces.com/problemset/problem/158/A", name: "Next Round", difficulty: "800" },
  { id: "2", date: getNext7Days()[1], problemId: "71A", url: "https://codeforces.com/problemset/problem/71/A", name: "Way Too Long Words", difficulty: "800" },
];

export default function SetProblemClient() {
  const availableDates = getNext7Days();
  const [problems, setProblems] = useState<PlannedProblem[]>(initialDummyData);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PlannedProblem>>({});
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const handleEdit = (problem: PlannedProblem) => {
    setIsEditing(problem.id);
    setFormData({ date: problem.date, problemId: problem.problemId }); // only setting date and problemId
  };

  const handleCancelEdit = () => {
    setIsEditing(null);
    setFormData({});
  };

  const handleSave = async () => {
    if (!formData.date || !formData.problemId) {
      alert("Date and Problem ID are required.");
      return;
    }

    setIsFetching(true);

    try {
      // Parse Codeforces Problem ID
      // Examples: "158A", "158 A", "158a"
      const idMatches = formData.problemId.match(/^(\d+)\s*([A-Z0-9]+)$/i);
      
      if (!idMatches) {
        alert("Invalid Problem ID. Ensure it looks like '158A'");
        setIsFetching(false);
        return;
      }
      
      const contestId = idMatches[1];
      const index = idMatches[2].toUpperCase();
      const generatedUrl = `https://codeforces.com/problemset/problem/${contestId}/${index}`;

      const response = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}`);
      
      if (!response.ok) {
        alert(`Failed to fetch from Codeforces API. Status: ${response.status}`);
        return;
      }

      const data = await response.json();
      
      if (data.status !== "OK") {
        alert("API Error: " + (data.comment || "Unknown error"));
        return;
      }
      
      const problem = data.result.problems.find(
        (p: any) => p.index.toUpperCase() === index.toUpperCase()
      );
      
      if (!problem) {
        alert(`Problem ${index} not found in Contest ${contestId}.`);
        return;
      }

      const newProblemData: PlannedProblem = {
        id: "",
        date: formData.date,
        problemId: `${contestId}${index}`,
        url: generatedUrl,
        name: problem.name,
        difficulty: problem.rating ? problem.rating.toString() : "Unrated",
      };

      if (isEditing === "new") {
        newProblemData.id = Math.random().toString();
        setProblems([...problems, newProblemData].sort((a, b) => a.date.localeCompare(b.date)));
      } else {
        newProblemData.id = isEditing as string;
        setProblems(problems.map(p => p.id === isEditing ? newProblemData : p));
      }
      
      setIsEditing(null);
      setFormData({});
    } catch (error) {
      alert("An error occurred while fetching the problem.");
      console.error(error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this scheduled problem?")) {
      setProblems(problems.filter(p => p.id !== id));
    }
  };

  const handleAddNew = () => {
    if (problems.length >= 7) {
      alert("You can only schedule up to 7 days in advance.");
      return;
    }
    setIsEditing("new");
    setFormData({
      date: availableDates.find(d => !problems.some(p => p.date === d)) || availableDates[0],
      problemId: "",
      url: "",
      name: "",
      difficulty: ""
    });
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
        {problems.length === 0 && isEditing !== "new" && (
          <div className={styles.emptyState}>
            No upcoming problems scheduled. Click "Add Problem" to get started.
          </div>
        )}

        {isEditing === "new" && (
          <div className={styles.editCard}>
            <div className={styles.editHeader}>
              <h3>Schedule New Problem</h3>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="editDate">Date</label>
                <select 
                  id="editDate"
                  title="Select Date"
                  value={formData.date || ""} 
                  onChange={e => setFormData({...formData, date: e.target.value})}
                >
                  {availableDates.map(d => (
                    <option key={d} value={d} disabled={problems.some(p => p.date === d)}>
                      {new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
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
                  value={formData.problemId || ""}
                  onChange={e => setFormData({...formData, problemId: e.target.value.toUpperCase()})}
                  disabled={isFetching}
                />
              </div>
            </div>
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={handleCancelEdit} disabled={isFetching}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={isFetching}>
                {isFetching ? "Fetching..." : "Fetch & Save"}
              </button>
            </div>
          </div>
        )}

        {problems.map((prob) => (
          isEditing === prob.id ? (
            <div key={prob.id} className={styles.editCard}>
              <div className={styles.editHeader}>
                <h3>Editing Problem</h3>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor={`editDate-${prob.id}`}>Date</label>
                  <select 
                    id={`editDate-${prob.id}`}
                    title="Select Date"
                    value={formData.date || ""} 
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    disabled={isFetching}
                  >
                    {availableDates.map(d => (
                      <option key={d} value={d} disabled={problems.some(p => p.date === d && p.id !== prob.id)}>
                        {new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor={`editProblemId-${prob.id}`}>Problem ID</label>
                  <input 
                    id={`editProblemId-${prob.id}`}
                    title="Codeforces Problem ID"
                    type="text" 
                    placeholder="e.g., 158A"
                    value={formData.problemId || ""}
                    onChange={e => setFormData({...formData, problemId: e.target.value.toUpperCase()})}
                    disabled={isFetching}
                  />
                </div>
              </div>
              <div className={styles.actions}>
                <button className={styles.cancelBtn} onClick={handleCancelEdit} disabled={isFetching}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleSave} disabled={isFetching}>
                  {isFetching ? "Fetching..." : "Fetch & Save"}
                </button>
              </div>
            </div>
          ) : (
            <div key={prob.id} className={styles.problemCard}>
              <div className={styles.cardHeader}>
                <span className={styles.dateLabel}>
                  {new Date(prob.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
                <div className={styles.cardActions}>
                  <button title="Edit Problem" className={styles.iconBtn} onClick={() => handleEdit(prob)} disabled={isEditing !== null}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button title="Delete Problem" className={styles.iconBtnDestructive} onClick={() => handleDelete(prob.id)} disabled={isEditing !== null}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
              <div className={styles.cardBody}>
                <h4>{prob.name}</h4>
                <div className={styles.meta}>
                  <span className={styles.difficulty}>Rating: {prob.difficulty || "N/A"}</span>
                  <a href={prob.url} target="_blank" rel="noreferrer" className={styles.urlLink}>View on CF ↗</a>
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}